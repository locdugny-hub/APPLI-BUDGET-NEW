/* Budget PWA v7.5.16
   Edition et suppression de tous les montants numériques d'une catégorie mensuelle,
   y compris les montants historiques déjà présents dans Google Sheets.
   Les saisies issues de l'app restent synchronisées avec le journal Saisies App.
*/
'use strict';

(function installV7516(){
  if(window.__budgetV7516) return;
  window.__budgetV7516=true;

  const style=document.createElement('style');
  style.textContent=`
    .v7516-right{display:flex;align-items:center;gap:7px;flex:none;margin-left:auto}
    .v7516-actions{display:flex;align-items:center;gap:5px;margin-left:3px}
    .v7516-act{width:34px;height:34px;border:1px solid #D9E2EE;border-radius:10px;background:#F7FAFE;color:var(--navy);font-size:16px;display:flex;align-items:center;justify-content:center;padding:0}
    .v7516-act:active{transform:scale(.96);background:#EDF4FC}
    .v7516-del{color:#C53B47;background:#FFF7F8;border-color:#F0D6D9}
    .v7516-source{font-size:10px;color:var(--muted);margin-top:2px}
    @media(max-width:600px){
      #m-hist .ent-row{gap:8px}
      .v7516-right{gap:5px}
      .v7516-act{width:38px;height:38px;border-radius:11px;font-size:17px}
      #m-hist .ea{white-space:nowrap}
    }
  `;
  document.head.appendChild(style);

  function serializeTerms(terms,sep,skipIdx,replaceIdx,replaceRaw){
    const parts=[];
    terms.forEach((t,i)=>{
      if(i===skipIdx) return;
      const raw=(i===replaceIdx)?replaceRaw:t.raw;
      const sign=t.sign<0?'-':'+';
      if(!parts.length) parts.push((t.sign<0?'-':'')+raw);
      else parts.push(sign+raw);
    });
    return parts.length?'='+parts.join(''):'';
  }

  async function loadEditableContext(label,tab){
    const st=await getTabStructure(tab);
    const R=st.map[label];
    if(!R) throw new Error(`Catégorie absente de l'onglet ${tab}.`);
    const col=st.colOf[label]||(CAT_INFO[label]&&CAT_INFO[label].col)||'C';
    const cell=`'${tab}'!${col}${R}`;
    const [fD,jD,sep]=await Promise.all([
      valuesGet(cell,'FORMULA'),
      valuesGet(`'${JOURNAL}'!A2:Q`,'UNFORMATTED_VALUE').catch(()=>({values:[]})),
      getDecSep()
    ]);
    const rawF=(fD.values&&fD.values[0]&&fD.values[0][0]!==undefined)?fD.values[0][0]:'';
    const parsed=parseFormulaTerms(rawF,sep);
    const terms=parsed.terms||[];

    /* Les ajouts via l'app sont toujours ajoutés en fin de formule.
       On associe donc les lignes du journal aux termes numériques en partant de la fin,
       ce qui évite de confondre un ancien 74 € avec un 74 € ajouté plus tard via l'app. */
    const rows=(jD.values||[]).map((r,i)=>({r:r||[],sheetRow:i+2}));
    const journal=rows.filter(x=>String(x.r[2]||'')===tab && String(x.r[3]||'')===label && (!x.r[6] || String(x.r[6])===cell));
    const meta=terms.map((t,i)=>({term:t,index:i,kind:t.num==null?'expr':'sheet',journal:null}));
    const used=new Set();
    [...journal].reverse().forEach(j=>{
      const amt=Math.abs(Number(j.r[4])||0);
      for(let i=terms.length-1;i>=0;i--){
        const t=terms[i];
        if(used.has(i)||t.num==null||t.sign<=0) continue;
        if(Math.abs(Number(t.num)-amt)<0.005){
          used.add(i); meta[i].kind='app'; meta[i].journal=j; break;
        }
      }
    });
    return {cell,terms,meta,sep};
  }

  async function refreshAfterChange(label,tab){
    delete monthCache[tab];
    journalCache=null;
    lastSync=Date.now();
    const seq=++detailSeq;
    await loadCatDetail(label,tab,seq);
    try{ if(typeof renderMonth==='function') renderMonth(); }catch(_){ }
    try{ if(typeof renderDashboard==='function') renderDashboard(); }catch(_){ }
  }

  async function editTerm(label,tab,ctx,item){
    const t=item.term;
    const old=Math.abs(Number(t.num)||0);
    const input=prompt(`Nouveau montant pour ${label} (${tab}) :`,String(old).replace('.',','));
    if(input==null) return;
    const norm=normAmount(input);
    if(norm==null){ toast('Montant invalide',true); return; }
    const raw=String(norm).replace('.',ctx.sep);
    const next=serializeTerms(ctx.terms,ctx.sep,-1,item.index,raw);
    await valuesUpdate(ctx.cell,next);

    if(item.kind==='app'&&item.journal){
      const row=item.journal.sheetRow;
      const amount=Number(norm);
      const signedOld=Number(item.journal.r[14]);
      const signed=Number.isFinite(signedOld)&&signedOld<0?-amount:amount;
      await valuesBatch([
        {range:`'${JOURNAL}'!E${row}`,values:[[amount]]},
        {range:`'${JOURNAL}'!O${row}`,values:[[signed]]}
      ]);
    }
    toast(`✅ Montant modifié : ${fmtEUR(Number(norm))}`);
    await refreshAfterChange(label,tab);
  }

  async function deleteTerm(label,tab,ctx,item){
    const amount=Math.abs(Number(item.term.num)||0);
    const source=item.kind==='app'?'saisie ajoutée via l’app':'montant déjà présent dans Google Sheets';
    if(!confirm(`Supprimer ${fmtEUR(amount)} de ${label} ?\n\n${source}\n${tab}`)) return;
    const next=serializeTerms(ctx.terms,ctx.sep,item.index,-1,'');
    await valuesUpdate(ctx.cell,next);
    if(item.kind==='app'&&item.journal){
      await deleteRowAt(JOURNAL,item.journal.sheetRow);
    }
    toast('🗑 Montant supprimé');
    await refreshAfterChange(label,tab);
  }

  async function enhanceRows(label,tab,seq){
    if(seq!==detailSeq) return;
    let ctx;
    try{ ctx=await loadEditableContext(label,tab); }
    catch(_){ return; }
    if(seq!==detailSeq) return;

    const rows=[...document.querySelectorAll('#m-hist .ent-row')];
    const items=ctx.meta;
    rows.forEach((row,i)=>{
      const item=items[i];
      if(!item||item.term.num==null||row.querySelector('.v7516-actions')) return;

      const labelEl=row.querySelector('.el');
      if(labelEl&&item.kind==='sheet'){
        labelEl.textContent=item.term.sign<0?'Correction Google Sheets':'Montant Google Sheets';
      }
      const left=row.firstElementChild;
      if(left && !left.querySelector('.v7516-source')){
        const s=document.createElement('div');
        s.className='v7516-source';
        s.textContent=item.kind==='app'?'Ajouté via l’app · modifiable':'Historique du fichier · modifiable';
        left.appendChild(s);
      }

      const amount=row.querySelector('.ea');
      if(!amount) return;
      const right=document.createElement('div'); right.className='v7516-right';
      amount.replaceWith(right); right.appendChild(amount);
      const acts=document.createElement('div'); acts.className='v7516-actions';
      const edit=document.createElement('button');
      edit.type='button'; edit.className='v7516-act'; edit.textContent='✎'; edit.title='Modifier ce montant'; edit.setAttribute('aria-label','Modifier ce montant');
      const del=document.createElement('button');
      del.type='button'; del.className='v7516-act v7516-del'; del.textContent='🗑'; del.title='Supprimer ce montant'; del.setAttribute('aria-label','Supprimer ce montant');
      edit.onclick=async()=>{ edit.disabled=true; del.disabled=true; try{ await editTerm(label,tab,ctx,item); }catch(e){ toast('Erreur : '+e.message,true); edit.disabled=false; del.disabled=false; } };
      del.onclick=async()=>{ edit.disabled=true; del.disabled=true; try{ await deleteTerm(label,tab,ctx,item); }catch(e){ toast('Erreur : '+e.message,true); edit.disabled=false; del.disabled=false; } };
      acts.append(edit,del); right.appendChild(acts);
    });
  }

  const previousLoad=loadCatDetail;
  loadCatDetail=async function(label,tab,seq){
    await previousLoad(label,tab,seq);
    await enhanceRows(label,tab,seq);
  };
})();
