/* Budget PWA v7.5.20
   - Edition universelle de toutes les categories mensuelles
   - Les formules historiques sont editables via leur valeur reelle
   - Les saisies App restent individualisees avec montant + commentaire
   - Une ligne historique modifiee est migree dans Saisies App pour les editions futures
   - Beaucoup moins de lectures Google Sheets pour eviter les quotas 429
*/
'use strict';

(function installV7520(){
  if(window.__budgetV7520) return;
  window.__budgetV7520=true;

  const detailCache=new Map();
  const TTL=30000;
  let editState=null;
  let deleteArmed=false;
  let deleteTimer=null;

  const css=document.createElement('style');
  css.textContent=`
    .v7520-right{display:flex;align-items:center;gap:7px;margin-left:auto;flex:none}
    .v7520-actions{display:flex;gap:5px}
    .v7520-act{width:38px;height:38px;border:1px solid #D9E2EE;border-radius:11px;background:#F7FAFE;color:var(--navy);font-size:17px;display:flex;align-items:center;justify-content:center;padding:0}
    .v7520-del{color:#C53B47;background:#FFF7F8;border-color:#F0D6D9}
    .v7520-source{font-size:10px;color:var(--muted);margin-top:2px}
    .v7520-overlay{position:fixed;inset:0;z-index:10100;background:rgba(7,21,42,.48);display:none;align-items:flex-end}
    .v7520-overlay.open{display:flex}
    .v7520-card{width:100%;background:#fff;border-radius:24px 24px 0 0;padding:10px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -18px 60px rgba(9,29,57,.25)}
    .v7520-handle{width:44px;height:5px;border-radius:999px;background:#D6DFEA;margin:2px auto 12px}
    .v7520-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:16px}
    .v7520-title{font-size:20px;font-weight:900;color:var(--navy)}
    .v7520-sub{font-size:12px;color:var(--muted);margin-top:4px}
    .v7520-close{width:40px;height:40px;border:0;border-radius:12px;background:#F1F5FA;color:var(--navy);font-size:24px}
    .v7520-field{margin:12px 0}
    .v7520-label{font-size:11px;font-weight:850;color:var(--muted);text-transform:uppercase;letter-spacing:.35px;margin:0 0 7px 2px}
    .v7520-input,.v7520-note{width:100%;box-sizing:border-box;border:1px solid #D6E0EC;border-radius:14px;background:#fff;color:var(--navy);font:inherit;font-size:17px;padding:13px 14px;outline:none}
    .v7520-input{height:52px;font-weight:800}
    .v7520-note{min-height:92px;resize:none;line-height:1.35}
    .v7520-info{font-size:11px;color:var(--muted);line-height:1.4;margin:8px 2px 14px}
    .v7520-buttons{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .v7520-save,.v7520-delete{height:50px;border-radius:14px;font-size:15px;font-weight:850}
    .v7520-save{border:0;background:#2E6FB7;color:#fff}
    .v7520-delete{border:1px solid #F0D6D9;background:#FFF7F8;color:#C53B47}
    .v7520-save:disabled,.v7520-delete:disabled{opacity:.5}
    @media(min-width:700px){.v7520-overlay{align-items:center;justify-content:center}.v7520-card{max-width:480px;border-radius:24px;padding-bottom:20px}}
  `;
  document.head.appendChild(css);

  function cacheKey(label,tab){ return tab+'|'+label; }
  function clearDetail(label,tab){ detailCache.delete(cacheKey(label,tab)); delete monthCache[tab]; journalCache=null; }

  async function readJournalRows(force){
    if(force) journalCache=null;
    const rows=await getJournal();
    return (rows||[]).map((r,i)=>({r:r||[],sheetRow:i+2})).filter(x=>x.r.some(v=>v!==''&&v!=null));
  }

  async function categorySnapshot(label,tab,force){
    const key=cacheKey(label,tab), now=Date.now();
    const old=detailCache.get(key);
    if(!force&&old&&now-old.at<TTL) return old.data;

    const st=await getTabStructure(tab);
    const R=st.map[label];
    if(!R) throw new Error(`Categorie absente de ${tab}.`);
    const col=st.colOf[label]||(CAT_INFO[label]&&CAT_INFO[label].col)||'C';
    const cell=`'${tab}'!${col}${R}`;

    /* Une seule lecture de cellule : sa valeur calculee suffit pour l'affichage.
       Le detail App vient du journal mis en cache. */
    const [vD,jRows]=await Promise.all([
      valuesGet(cell,'UNFORMATTED_VALUE'),
      readJournalRows(!!force)
    ]);
    const total=(vD.values&&vD.values[0]&&vD.values[0][0]!=null)?Number(vD.values[0][0])||0:0;
    const tracked=jRows.filter(x=>String(x.r[2]||'')===tab&&String(x.r[3]||'')===label&&(!x.r[6]||String(x.r[6])===cell));
    const trackedTotal=tracked.reduce((s,x)=>s+(Number(x.r[4])||0),0);
    let historical=total-trackedTotal;
    if(Math.abs(historical)<0.005) historical=0;
    const data={label,tab,col,cell,total,tracked,historical};
    detailCache.set(key,{at:now,data});
    return data;
  }

  function ensureEditor(){
    let ov=document.getElementById('v7520-overlay');
    if(ov) return ov;
    ov=document.createElement('div');
    ov.id='v7520-overlay'; ov.className='v7520-overlay';
    ov.innerHTML=`<div class="v7520-card">
      <div class="v7520-handle"></div>
      <div class="v7520-head"><div><div class="v7520-title"></div><div class="v7520-sub"></div></div><button type="button" class="v7520-close">×</button></div>
      <div class="v7520-field"><div class="v7520-label">Montant</div><input class="v7520-input" inputmode="decimal" autocomplete="off"></div>
      <div class="v7520-field"><div class="v7520-label">Commentaire</div><textarea class="v7520-note" placeholder="Commentaire facultatif"></textarea></div>
      <div class="v7520-info"></div>
      <div class="v7520-buttons"><button type="button" class="v7520-delete">Supprimer</button><button type="button" class="v7520-save">Enregistrer</button></div>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector('.v7520-close').onclick=closeEditor;
    ov.onclick=e=>{if(e.target===ov) closeEditor();};
    ov.querySelector('.v7520-save').onclick=saveEdit;
    ov.querySelector('.v7520-delete').onclick=deleteEdit;
    return ov;
  }

  function resetDelete(){
    deleteArmed=false;
    if(deleteTimer){clearTimeout(deleteTimer);deleteTimer=null;}
    const ov=document.getElementById('v7520-overlay'), b=ov&&ov.querySelector('.v7520-delete');
    if(b){b.textContent='Supprimer';b.style.background='#FFF7F8';b.style.color='#C53B47';}
  }
  function closeEditor(){
    const ov=document.getElementById('v7520-overlay');
    if(ov) ov.classList.remove('open');
    resetDelete(); editState=null;
  }

  function openEditor(label,tab,item){
    const ov=ensureEditor();
    editState={label,tab,kind:item.kind,amount:Number(item.amount)||0,journalRow:item.journalRow||null,note:item.note||''};
    ov.querySelector('.v7520-title').textContent=label;
    ov.querySelector('.v7520-sub').textContent=tab;
    ov.querySelector('.v7520-input').value=String(editState.amount).replace('.',',');
    ov.querySelector('.v7520-note').value=editState.note;
    ov.querySelector('.v7520-info').textContent=item.kind==='historical'
      ?'Montant historique du Google Sheet. Si tu le modifies, seule cette categorie de ce mois change. Elle sera ensuite suivie comme une ligne modifiable dans l’app.'
      :'Saisie suivie par l’app. Le montant et le commentaire seront mis a jour ensemble dans Google Sheets.';
    resetDelete();
    ov.classList.add('open');
    setTimeout(()=>ov.querySelector('.v7520-input').focus(),120);
  }

  function journalAnalysis(label,note,col,dateISO){
    const a=classifyJournalEntry(label,note,col,dateISO);
    return a;
  }

  async function appendTrackedLine(snap,amount,note){
    await ensureJournal();
    const dateISO=presetISOFor(snap.tab);
    const a=journalAnalysis(snap.label,note,snap.col,dateISO);
    await valuesAppend(`'${JOURNAL}'!A:Q`,[
      new Date().toISOString(),dateISO,snap.tab,snap.label,amount,note||'',snap.cell,false,
      a.sense,a.tag,a.nature,a.rec,a.year,a.month,a.signed*amount,a.source,''
    ]);
  }

  async function saveEdit(){
    if(!editState) return;
    const saved={...editState}, ov=ensureEditor();
    const save=ov.querySelector('.v7520-save'), del=ov.querySelector('.v7520-delete');
    const norm=normAmount(ov.querySelector('.v7520-input').value);
    if(norm==null){toast('Montant invalide',true);return;}
    const amount=Number(norm), note=ov.querySelector('.v7520-note').value.trim();
    save.disabled=del.disabled=true;
    try{
      const snap=await categorySnapshot(saved.label,saved.tab,true);
      const writes=[];
      let newTotal=snap.total;

      if(saved.kind==='app'){
        const row=snap.tracked.find(x=>x.sheetRow===saved.journalRow);
        if(!row) throw new Error('Saisie introuvable apres actualisation.');
        const old=Number(row.r[4])||0;
        newTotal=snap.total-old+amount;
        const dateISO=String(row.r[1]||todayISO());
        const a=journalAnalysis(saved.label,note,snap.col,dateISO);
        writes.push({range:snap.cell,values:[[String(newTotal).replace('.',await getDecSep())]]});
        writes.push({range:`'${JOURNAL}'!E${row.sheetRow}:Q${row.sheetRow}`,values:[[
          amount,note,snap.cell,row.r[7]||false,a.sense,a.tag,a.nature,a.rec,a.year,a.month,a.signed*amount,a.source,row.r[16]||''
        ]]});
        await valuesBatch(writes);
      }else{
        /* Le composant historique devient une ligne suivie. Le reste des saisies App est preserve. */
        const trackedTotal=snap.tracked.reduce((s,x)=>s+(Number(x.r[4])||0),0);
        newTotal=trackedTotal+amount;
        await valuesUpdate(snap.cell,String(newTotal).replace('.',await getDecSep()));
        await appendTrackedLine(snap,amount,note);
      }

      clearDetail(saved.label,saved.tab);
      closeEditor();
      toast('✅ Saisie modifiee');
      await loadCatDetail(saved.label,saved.tab,++detailSeq);
      try{renderMois();}catch(_){}
      try{renderDashboard();}catch(_){}
    }catch(e){
      toast(e&&e.message&&e.message.includes('429')?'Google Sheets limite temporairement les lectures. Attends quelques secondes puis reessaie.':'Erreur : '+e.message,true);
    }finally{save.disabled=del.disabled=false;}
  }

  async function deleteEdit(){
    if(!editState) return;
    const ov=ensureEditor(), save=ov.querySelector('.v7520-save'), del=ov.querySelector('.v7520-delete');
    if(!deleteArmed){
      deleteArmed=true; del.textContent='Confirmer la suppression'; del.style.background='#C53B47'; del.style.color='#fff';
      deleteTimer=setTimeout(resetDelete,5000); return;
    }
    const saved={...editState};
    save.disabled=del.disabled=true;
    try{
      const snap=await categorySnapshot(saved.label,saved.tab,true);
      let newTotal=snap.total;
      const writes=[];
      if(saved.kind==='app'){
        const row=snap.tracked.find(x=>x.sheetRow===saved.journalRow);
        if(!row) throw new Error('Saisie introuvable apres actualisation.');
        newTotal=snap.total-(Number(row.r[4])||0);
        writes.push({range:snap.cell,values:[[String(newTotal).replace('.',await getDecSep())]]});
        writes.push({range:`'${JOURNAL}'!A${row.sheetRow}:Q${row.sheetRow}`,values:[new Array(17).fill('')]});
        await valuesBatch(writes);
      }else{
        newTotal=snap.total-snap.historical;
        await valuesUpdate(snap.cell,String(newTotal).replace('.',await getDecSep()));
      }

      /* Une seule verification apres une suppression explicite. */
      const chk=await valuesGet(snap.cell,'UNFORMATTED_VALUE');
      const got=(chk.values&&chk.values[0]&&chk.values[0][0]!=null)?Number(chk.values[0][0])||0:0;
      if(Math.abs(got-newTotal)>0.01) throw new Error('La suppression n’a pas ete confirmee par Google Sheets.');

      clearDetail(saved.label,saved.tab);
      closeEditor();
      toast('🗑 Saisie supprimee');
      await loadCatDetail(saved.label,saved.tab,++detailSeq);
      try{renderMois();}catch(_){}
      try{renderDashboard();}catch(_){}
    }catch(e){
      resetDelete();
      toast(e&&e.message&&e.message.includes('429')?'Google Sheets limite temporairement les lectures. Attends quelques secondes puis reessaie.':'Erreur suppression : '+e.message,true);
    }finally{save.disabled=del.disabled=false;}
  }

  function addRow(hist,item){
    const row=el('div','ent-row');
    const left=el('div');
    if(item.kind==='app'){
      left.appendChild(el('div','el',frDate(item.date)));
      if(item.note) left.appendChild(el('div','em',item.note));
      left.appendChild(el('div','v7520-source','Ajoute via l’app · modifiable'));
    }else{
      left.appendChild(el('div','el','Montant historique Google Sheets'));
      if(item.note) left.appendChild(el('div','em',item.note));
      left.appendChild(el('div','v7520-source','Historique du fichier · modifiable'));
    }
    row.appendChild(left);
    const right=document.createElement('div'); right.className='v7520-right';
    right.appendChild(el('div','ea',fmtEUR(item.amount)));
    const acts=document.createElement('div');acts.className='v7520-actions';
    const edit=document.createElement('button');edit.type='button';edit.className='v7520-act';edit.textContent='✎';edit.setAttribute('aria-label','Modifier');
    const del=document.createElement('button');del.type='button';del.className='v7520-act v7520-del';del.textContent='🗑';del.setAttribute('aria-label','Supprimer');
    edit.onclick=e=>{e.preventDefault();e.stopPropagation();openEditor(item.label,item.tab,item);};
    del.onclick=e=>{e.preventDefault();e.stopPropagation();openEditor(item.label,item.tab,item);};
    acts.append(edit,del);right.appendChild(acts);row.appendChild(right);hist.appendChild(row);
  }

  /* Remplace toute l'ancienne chaine de rendu v7.5.16/v7.5.18.
     Ainsi ouvrir une categorie ne relit plus la cellule trois fois. */
  loadCatDetail=async function(label,tab,seq){
    const hist=$('#m-hist');
    try{
      const snap=await categorySnapshot(label,tab,false);
      if(seq!==detailSeq) return;
      $('#m-total').textContent=fmtEUR(snap.total);
      hist.innerHTML='';
      $('#m-histnote').style.display='none';

      const items=[];
      snap.tracked.forEach(x=>items.push({
        kind:'app',label,tab,amount:Number(x.r[4])||0,date:String(x.r[1]||''),note:String(x.r[5]||''),journalRow:x.sheetRow
      }));
      if(Math.abs(snap.historical)>=0.005){
        items.unshift({kind:'historical',label,tab,amount:snap.historical,note:'',journalRow:null});
      }

      $('#m-count').textContent=items.length?`${items.length} entree${items.length>1?'s':''}`:'';
      if(!items.length){hist.appendChild(el('p','muted','Aucune entree ce mois-ci.'));return;}
      items.forEach(it=>addRow(hist,it));
    }catch(e){
      if(seq!==detailSeq) return;
      $('#m-total').textContent='—';
      hist.innerHTML='';
      const msg=e&&e.message&&e.message.includes('429')
        ?'Google Sheets limite temporairement les lectures. Patiente quelques secondes puis reouvre la categorie.'
        :(navigator.onLine?'Historique indisponible : '+e.message:'Hors-ligne : historique indisponible.');
      hist.appendChild(el('p','muted',msg));
    }
  };
})();