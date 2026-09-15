/* Budget PWA v7.5.18
   - Editeur fiable des saisies sur mobile
   - Modification du montant ET du commentaire
   - Suppression sans décalage des lignes du journal
   - Relecture de la cellule juste avant chaque écriture pour éviter les contextes périmés
*/
'use strict';

(function installV7518(){
  if(window.__budgetV7518) return;
  window.__budgetV7518=true;

  const style=document.createElement('style');
  style.textContent=`
    .v7518-overlay{position:fixed;inset:0;z-index:10050;background:rgba(7,21,42,.46);display:none;align-items:flex-end}
    .v7518-overlay.open{display:flex}
    .v7518-card{width:100%;background:#fff;border-radius:24px 24px 0 0;padding:10px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -18px 60px rgba(9,29,57,.24)}
    .v7518-handle{width:44px;height:5px;border-radius:999px;background:#D6DFEA;margin:2px auto 12px}
    .v7518-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}
    .v7518-title{font-size:20px;font-weight:900;color:var(--navy);line-height:1.2}
    .v7518-sub{font-size:12px;color:var(--muted);margin-top:4px}
    .v7518-close{width:40px;height:40px;border:0;border-radius:12px;background:#F1F5FA;color:var(--navy);font-size:24px;display:flex;align-items:center;justify-content:center}
    .v7518-field{margin:12px 0}
    .v7518-label{font-size:11px;font-weight:850;color:var(--muted);text-transform:uppercase;letter-spacing:.35px;margin:0 0 7px 2px}
    .v7518-input,.v7518-textarea{width:100%;box-sizing:border-box;border:1px solid #D6E0EC;border-radius:14px;background:#fff;color:var(--navy);font:inherit;font-size:17px;padding:13px 14px;outline:none}
    .v7518-input{height:52px;font-weight:800}
    .v7518-textarea{min-height:92px;resize:none;line-height:1.35}
    .v7518-input:focus,.v7518-textarea:focus{border-color:#7FA8D8;box-shadow:0 0 0 3px rgba(46,111,183,.10)}
    .v7518-info{font-size:11px;color:var(--muted);margin:8px 2px 14px;line-height:1.35}
    .v7518-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
    .v7518-save,.v7518-delete{height:50px;border-radius:14px;font-size:15px;font-weight:850}
    .v7518-save{border:0;background:#2E6FB7;color:#fff}
    .v7518-delete{border:1px solid #F0D6D9;background:#FFF7F8;color:#C53B47}
    .v7518-save:disabled,.v7518-delete:disabled{opacity:.5}
    @media(min-width:700px){.v7518-overlay{align-items:center;justify-content:center}.v7518-card{max-width:480px;border-radius:24px;padding-bottom:20px}}
  `;
  document.head.appendChild(style);

  function ensureEditor(){
    let ov=document.getElementById('v7518-overlay');
    if(ov) return ov;
    ov=document.createElement('div');
    ov.id='v7518-overlay'; ov.className='v7518-overlay';
    ov.innerHTML=`<div class="v7518-card">
      <div class="v7518-handle"></div>
      <div class="v7518-head"><div><div class="v7518-title" id="v7518-title">Modifier</div><div class="v7518-sub" id="v7518-sub"></div></div><button type="button" class="v7518-close" aria-label="Fermer">×</button></div>
      <div class="v7518-field"><div class="v7518-label">Montant</div><input id="v7518-amount" class="v7518-input" inputmode="decimal" autocomplete="off"></div>
      <div class="v7518-field"><div class="v7518-label">Commentaire</div><textarea id="v7518-note" class="v7518-textarea" placeholder="Commentaire facultatif"></textarea></div>
      <div class="v7518-info" id="v7518-info"></div>
      <div class="v7518-actions"><button type="button" class="v7518-delete">Supprimer</button><button type="button" class="v7518-save">Enregistrer</button></div>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector('.v7518-close').onclick=()=>closeEditor();
    ov.onclick=e=>{ if(e.target===ov) closeEditor(); };
    return ov;
  }

  let current=null;
  function closeEditor(){
    const ov=document.getElementById('v7518-overlay');
    if(ov) ov.classList.remove('open');
    current=null;
  }

  function formulaFromTerms(terms,skipIndex,replaceIndex,replaceRaw){
    const out=[];
    terms.forEach((t,i)=>{
      if(i===skipIndex) return;
      const raw=i===replaceIndex?replaceRaw:t.raw;
      if(!out.length) out.push((t.sign<0?'-':'')+raw);
      else out.push((t.sign<0?'-':'+')+raw);
    });
    return out.length?'='+out.join(''):'';
  }

  async function contextFor(label,tab){
    const st=await getTabStructure(tab);
    const R=st.map[label];
    if(!R) throw new Error(`Catégorie absente de ${tab}.`);
    const col=st.colOf[label]||(CAT_INFO[label]&&CAT_INFO[label].col)||'C';
    const cell=`'${tab}'!${col}${R}`;
    const [fD,jD,sep]=await Promise.all([
      valuesGet(cell,'FORMULA'),
      valuesGet(`'${JOURNAL}'!A2:Q`,'UNFORMATTED_VALUE').catch(()=>({values:[]})),
      getDecSep()
    ]);
    const rawF=(fD.values&&fD.values[0]&&fD.values[0][0]!==undefined)?fD.values[0][0]:'';
    const terms=(parseFormulaTerms(rawF,sep).terms||[]);
    const rows=(jD.values||[]).map((r,i)=>({r:r||[],sheetRow:i+2}));
    const journal=rows.filter(x=>String(x.r[2]||'')===tab&&String(x.r[3]||'')===label&&(!x.r[6]||String(x.r[6])===cell));
    const meta=terms.map((t,i)=>({term:t,index:i,kind:t.num==null?'expr':'sheet',journal:null}));
    const used=new Set();
    [...journal].reverse().forEach(j=>{
      const amt=Math.abs(Number(j.r[4])||0);
      for(let i=terms.length-1;i>=0;i--){
        const t=terms[i];
        if(used.has(i)||t.num==null||t.sign<=0) continue;
        if(Math.abs(Number(t.num)-amt)<0.005){ used.add(i); meta[i].kind='app'; meta[i].journal=j; break; }
      }
    });
    return {label,tab,col,cell,terms,meta,sep};
  }

  function findFreshItem(ctx,saved){
    if(saved.journalRow){
      const m=ctx.meta.find(x=>x.journal&&x.journal.sheetRow===saved.journalRow);
      if(m) return m;
    }
    if(Number.isInteger(saved.index)&&ctx.meta[saved.index]&&ctx.meta[saved.index].term.num!=null) return ctx.meta[saved.index];
    const target=Number(saved.amount)||0;
    return ctx.meta.find(x=>x.term.num!=null&&Math.abs(Math.abs(Number(x.term.num))-target)<0.005)||null;
  }

  async function refresh(label,tab){
    delete monthCache[tab]; journalCache=null; lastSync=Date.now();
    const seq=++detailSeq;
    await loadCatDetail(label,tab,seq);
    try{ if(typeof renderMonth==='function') renderMonth(); }catch(_){ }
    try{ if(typeof renderDashboard==='function') renderDashboard(); }catch(_){ }
  }

  async function saveCurrent(){
    if(!current) return;
    const ov=ensureEditor(), save=ov.querySelector('.v7518-save'), del=ov.querySelector('.v7518-delete');
    const norm=normAmount(ov.querySelector('#v7518-amount').value);
    if(norm==null){ toast('Montant invalide',true); return; }
    const note=ov.querySelector('#v7518-note').value.trim();
    save.disabled=del.disabled=true;
    try{
      const ctx=await contextFor(current.label,current.tab);
      const item=findFreshItem(ctx,current);
      if(!item) throw new Error('Saisie introuvable après actualisation.');
      const raw=String(norm).replace('.',ctx.sep);
      const next=formulaFromTerms(ctx.terms,-1,item.index,raw);
      await valuesUpdate(ctx.cell,next);

      if(item.kind==='app'&&item.journal){
        const r=item.journal.r, row=item.journal.sheetRow, amount=Number(norm), dateISO=String(r[1]||todayISO());
        const a=classifyJournalEntry(current.label,note,ctx.col,dateISO);
        const signed=a.signed*amount;
        await valuesUpdateRow(`'${JOURNAL}'!E${row}:Q${row}`,[amount,note,ctx.cell,r[7]||false,a.sense,a.tag,a.nature,a.rec,a.year,a.month,signed,a.source,r[16]||''],'USER_ENTERED');
      }else if(note){
        /* Pour un montant historique sans ligne de journal, on crée une trace d'édition
           afin que le commentaire soit conservé et que les prochaines modifications soient fiables. */
        await ensureJournal();
        const dateISO=presetISOFor(current.tab);
        const a=classifyJournalEntry(current.label,note,ctx.col,dateISO);
        const amount=Number(norm);
        await valuesAppend(`'${JOURNAL}'!A:Q`,[new Date().toISOString(),dateISO,current.tab,current.label,amount,note,ctx.cell,false,a.sense,a.tag,a.nature,a.rec,a.year,a.month,a.signed*amount,a.source,'']);
      }
      closeEditor();
      toast('✅ Saisie modifiée');
      await refresh(current?current.label:ctx.label,current?current.tab:ctx.tab);
    }catch(e){ toast('Erreur : '+e.message,true); }
    finally{ save.disabled=del.disabled=false; }
  }

  async function deleteCurrent(){
    if(!current) return;
    const ov=ensureEditor(), save=ov.querySelector('.v7518-save'), del=ov.querySelector('.v7518-delete');
    if(!confirm(`Supprimer définitivement cette saisie de ${current.label} ?`)) return;
    save.disabled=del.disabled=true;
    const saved={...current};
    try{
      const ctx=await contextFor(saved.label,saved.tab);
      const item=findFreshItem(ctx,saved);
      if(!item) throw new Error('Saisie introuvable après actualisation.');
      const next=formulaFromTerms(ctx.terms,item.index,-1,'');
      await valuesUpdate(ctx.cell,next);
      if(item.kind==='app'&&item.journal){
        /* Ne supprime plus physiquement la ligne : cela évite de décaler les autres
           références pendant que la fiche est encore ouverte sur iOS. */
        await valuesUpdateRow(`'${JOURNAL}'!A${item.journal.sheetRow}:Q${item.journal.sheetRow}`,new Array(17).fill(''),'RAW');
      }
      closeEditor();
      toast('🗑 Saisie supprimée');
      await refresh(saved.label,saved.tab);
    }catch(e){ toast('Erreur : '+e.message,true); }
    finally{ save.disabled=del.disabled=false; }
  }

  function openEditor(label,tab,item){
    const ov=ensureEditor();
    current={label,tab,index:item.index,amount:Math.abs(Number(item.term.num)||0),journalRow:item.journal?item.journal.sheetRow:null};
    ov.querySelector('#v7518-title').textContent=label;
    ov.querySelector('#v7518-sub').textContent=tab;
    ov.querySelector('#v7518-amount').value=String(current.amount).replace('.',',');
    ov.querySelector('#v7518-note').value=item.journal?String(item.journal.r[5]||''):'';
    ov.querySelector('#v7518-info').textContent=item.kind==='app'?'Montant et commentaire issus de l’app. Les deux seront synchronisés avec Google Sheets.':'Montant historique Google Sheets. Tu peux aussi lui ajouter un commentaire.';
    ov.querySelector('.v7518-save').onclick=saveCurrent;
    ov.querySelector('.v7518-delete').onclick=deleteCurrent;
    ov.classList.add('open');
    setTimeout(()=>ov.querySelector('#v7518-amount').focus(),120);
  }

  async function replaceActions(label,tab,seq){
    if(seq!==detailSeq) return;
    let ctx; try{ ctx=await contextFor(label,tab); }catch(_){ return; }
    if(seq!==detailSeq) return;
    const rows=[...document.querySelectorAll('#m-hist .ent-row')];
    rows.forEach((row,i)=>{
      const item=ctx.meta[i];
      if(!item||item.term.num==null) return;
      const oldActs=row.querySelector('.v7516-actions');
      if(!oldActs) return;
      const buttons=[...oldActs.querySelectorAll('button')];
      const edit=buttons[0], del=buttons[1];
      if(edit){ edit.onclick=e=>{e.preventDefault();e.stopPropagation();openEditor(label,tab,item);}; edit.title='Modifier montant et commentaire'; edit.setAttribute('aria-label','Modifier montant et commentaire'); }
      if(del){ del.onclick=e=>{e.preventDefault();e.stopPropagation();openEditor(label,tab,item);}; del.title='Ouvrir pour supprimer'; del.setAttribute('aria-label','Ouvrir pour supprimer'); }
    });
  }

  const prev=loadCatDetail;
  loadCatDetail=async function(label,tab,seq){
    await prev(label,tab,seq);
    await replaceActions(label,tab,seq);
  };
})();
