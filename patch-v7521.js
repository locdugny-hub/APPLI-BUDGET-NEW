/* Budget PWA v7.5.21
   - Transaction ledger stable: no fragile arithmetic formulas for App entries
   - Move an App expense directly to another category without delete/re-add
   - Preserve date, amount, note and individual detail in Saisies App
   - Universal editing of historical and App amounts
   - Recurring category "Accompte impots foncier" = 44 EUR from November 2026 onward
*/
'use strict';

(function installV7521(){
  if(window.__budgetV7521) return;
  window.__budgetV7521=true;

  const TAX_LABEL='🏛️ Accompte impots foncier';
  const TAX_AMOUNT=44;
  const TAX_START_ORD=2026*12+10; // November 2026, zero-based month
  const TAX_MIGRATION_KEY='budget_tax_advance_v7521_done';

  let editorState=null;
  let deleteArmed=false;
  let deleteTimer=null;
  const detailCache7521=new Map();
  const DETAIL_TTL=30000;

  const style=document.createElement('style');
  style.textContent=`
    .v7521-right{display:flex;align-items:center;gap:7px;margin-left:auto;flex:none}
    .v7521-actions{display:flex;gap:5px}
    .v7521-act{width:38px;height:38px;border:1px solid #D9E2EE;border-radius:11px;background:#F7FAFE;color:var(--navy);font-size:17px;display:flex;align-items:center;justify-content:center;padding:0}
    .v7521-del{color:#C53B47;background:#FFF7F8;border-color:#F0D6D9}
    .v7521-source{font-size:10px;color:var(--muted);margin-top:2px}
    .v7521-overlay{position:fixed;inset:0;z-index:10200;background:rgba(7,21,42,.48);display:none;align-items:flex-end}
    .v7521-overlay.open{display:flex}
    .v7521-card{width:100%;background:#fff;border-radius:24px 24px 0 0;padding:10px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -18px 60px rgba(9,29,57,.25)}
    .v7521-handle{width:44px;height:5px;border-radius:999px;background:#D6DFEA;margin:2px auto 12px}
    .v7521-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
    .v7521-title{font-size:20px;font-weight:900;color:var(--navy);line-height:1.2}
    .v7521-sub{font-size:12px;color:var(--muted);margin-top:4px}
    .v7521-close{width:40px;height:40px;border:0;border-radius:12px;background:#F1F5FA;color:var(--navy);font-size:24px}
    .v7521-field{margin:12px 0}
    .v7521-label{font-size:11px;font-weight:850;color:var(--muted);text-transform:uppercase;letter-spacing:.35px;margin:0 0 7px 2px}
    .v7521-input,.v7521-select,.v7521-note{width:100%;box-sizing:border-box;border:1px solid #D6E0EC;border-radius:14px;background:#fff;color:var(--navy);font:inherit;font-size:16px;padding:13px 14px;outline:none}
    .v7521-input,.v7521-select{height:52px;font-weight:800}
    .v7521-note{min-height:92px;resize:none;line-height:1.35}
    .v7521-select:disabled{background:#F3F6FA;color:#677489}
    .v7521-info{font-size:11px;color:var(--muted);line-height:1.4;margin:8px 2px 14px}
    .v7521-buttons{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .v7521-save,.v7521-delete{height:50px;border-radius:14px;font-size:15px;font-weight:850}
    .v7521-save{border:0;background:#2E6FB7;color:#fff}
    .v7521-delete{border:1px solid #F0D6D9;background:#FFF7F8;color:#C53B47}
    .v7521-save:disabled,.v7521-delete:disabled{opacity:.5}
    @media(min-width:700px){.v7521-overlay{align-items:center;justify-content:center}.v7521-card{max-width:500px;border-radius:24px;padding-bottom:20px}}
  `;
  document.head.appendChild(style);

  function monthOrd(tab){
    const p=parseMonthTitle(tab);
    return p?p.y*12+p.m:null;
  }
  function detailKey(label,tab){ return tab+'|'+label; }
  function clearCaches(label,tab){
    if(label&&tab) detailCache7521.delete(detailKey(label,tab));
    if(tab) delete monthCache[tab];
    journalCache=null;
    lastSync=Date.now();
  }
  async function journalRowsQ(){
    await ensureJournal();
    const d=await valuesGet(`'${JOURNAL}'!A2:Q`,'UNFORMATTED_VALUE');
    return d.values||[];
  }
  function freeJournalRow(rows){
    for(let i=0;i<rows.length;i++){
      const r=rows[i]||[];
      if(!r.some(v=>v!==''&&v!=null)) return i+2;
    }
    return rows.length+2;
  }
  async function categoryInfo(tab,label){
    const st=await getTabStructure(tab);
    const row=st.map[label];
    if(!row) throw new Error(`Categorie « ${label} » absente de ${tab}.`);
    const col=st.colOf[label]||(CAT_INFO[label]&&CAT_INFO[label].col)||'C';
    return {st,row,col,cell:`'${tab}'!${col}${row}`};
  }
  async function readCellNumber(cell){
    const d=await valuesGet(cell,'UNFORMATTED_VALUE');
    return (d.values&&d.values[0]&&d.values[0][0]!=null)?Number(d.values[0][0])||0:0;
  }
  function buildJournalRow({oldRow,dateISO,tab,label,amount,note,cell,col}){
    const a=classifyJournalEntry(label,note,col,dateISO);
    return [
      oldRow&&oldRow[0]?oldRow[0]:new Date().toISOString(),
      dateISO,tab,label,amount,note||'',cell,
      oldRow&&oldRow[7]!==undefined?oldRow[7]:false,
      a.sense,a.tag,a.nature,a.rec,a.year,a.month,a.signed*amount,a.source,
      oldRow&&oldRow[16]?oldRow[16]:''
    ];
  }

  async function snapshot(label,tab,force){
    const key=detailKey(label,tab), now=Date.now();
    const cached=detailCache7521.get(key);
    if(!force&&cached&&now-cached.at<DETAIL_TTL) return cached.data;

    const info=await categoryInfo(tab,label);
    const [total,jRows]=await Promise.all([readCellNumber(info.cell),getJournal()]);
    const tracked=(jRows||[]).map((r,i)=>({r:r||[],sheetRow:i+2}))
      .filter(x=>x.r.some(v=>v!==''&&v!=null))
      .filter(x=>String(x.r[2]||'')===tab&&String(x.r[3]||'')===label&&(!x.r[6]||String(x.r[6])===info.cell));
    const trackedTotal=tracked.reduce((s,x)=>s+(Number(x.r[4])||0),0);
    let historical=total-trackedTotal;
    if(Math.abs(historical)<0.005) historical=0;
    const data={label,tab,...info,total,tracked,trackedTotal,historical};
    detailCache7521.set(key,{at:now,data});
    return data;
  }

  function ensureEditor(){
    let ov=document.getElementById('v7521-overlay');
    if(ov) return ov;
    ov=document.createElement('div');
    ov.id='v7521-overlay'; ov.className='v7521-overlay';
    ov.innerHTML=`<div class="v7521-card">
      <div class="v7521-handle"></div>
      <div class="v7521-head"><div><div class="v7521-title"></div><div class="v7521-sub"></div></div><button type="button" class="v7521-close" aria-label="Fermer">×</button></div>
      <div class="v7521-field"><div class="v7521-label">Categorie</div><select class="v7521-select"></select></div>
      <div class="v7521-field"><div class="v7521-label">Montant</div><input class="v7521-input" inputmode="decimal" autocomplete="off"></div>
      <div class="v7521-field"><div class="v7521-label">Commentaire</div><textarea class="v7521-note" placeholder="Commentaire facultatif"></textarea></div>
      <div class="v7521-info"></div>
      <div class="v7521-buttons"><button type="button" class="v7521-delete">Supprimer</button><button type="button" class="v7521-save">Enregistrer</button></div>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector('.v7521-close').onclick=closeEditor;
    ov.onclick=e=>{if(e.target===ov) closeEditor();};
    ov.querySelector('.v7521-save').onclick=saveEditor;
    ov.querySelector('.v7521-delete').onclick=deleteEditor;
    return ov;
  }
  function resetDelete(){
    deleteArmed=false;
    if(deleteTimer){clearTimeout(deleteTimer);deleteTimer=null;}
    const ov=document.getElementById('v7521-overlay');
    const b=ov&&ov.querySelector('.v7521-delete');
    if(b){b.textContent='Supprimer';b.style.background='#FFF7F8';b.style.color='#C53B47';}
  }
  function closeEditor(){
    const ov=document.getElementById('v7521-overlay');
    if(ov) ov.classList.remove('open');
    resetDelete();
    editorState=null;
  }
  async function fillCategories(sel,tab,current,col,allowMove){
    sel.innerHTML='';
    const st=await getTabStructure(tab);
    st.sections.forEach(sec=>{
      const labels=sec.labels.filter(l=>(st.colOf[l]||'C')===col);
      if(!labels.length) return;
      const g=document.createElement('optgroup');
      g.label=cleanSection(sec.name);
      labels.forEach(l=>{
        const o=document.createElement('option');
        o.value=l;o.textContent=l;o.selected=l===current;g.appendChild(o);
      });
      sel.appendChild(g);
    });
    sel.disabled=!allowMove;
  }
  async function openEditor(item){
    const ov=ensureEditor();
    editorState={...item};
    ov.querySelector('.v7521-title').textContent=item.label;
    ov.querySelector('.v7521-sub').textContent=item.tab;
    ov.querySelector('.v7521-input').value=String(Math.abs(Number(item.amount)||0)).replace('.',',');
    ov.querySelector('.v7521-note').value=item.note||'';
    await fillCategories(ov.querySelector('.v7521-select'),item.tab,item.label,item.col,item.kind==='app');
    ov.querySelector('.v7521-info').textContent=item.kind==='app'
      ?'Tu peux modifier le montant, le commentaire ou changer directement de categorie. Le deplacement conserve la saisie et son detail.'
      :'Montant historique Google Sheets. Il est modifiable ou supprimable pour ce mois. Le changement de categorie est reserve aux saisies individuelles faites via l’app.';
    resetDelete();
    ov.classList.add('open');
  }

  async function freshJournalRow(rowNum){
    const d=await valuesGet(`'${JOURNAL}'!A${rowNum}:Q${rowNum}`,'UNFORMATTED_VALUE');
    return (d.values&&d.values[0])?d.values[0]:[];
  }

  async function saveEditor(){
    if(!editorState) return;
    const saved={...editorState}, ov=ensureEditor();
    const save=ov.querySelector('.v7521-save'), del=ov.querySelector('.v7521-delete');
    const norm=normAmount(ov.querySelector('.v7521-input').value);
    if(norm==null){toast('Montant invalide',true);return;}
    const amount=Number(norm);
    const note=ov.querySelector('.v7521-note').value.trim();
    const targetLabel=ov.querySelector('.v7521-select').value||saved.label;
    save.disabled=del.disabled=true;

    try{
      const src=await snapshot(saved.label,saved.tab,true);

      if(saved.kind==='app'){
        const oldRow=await freshJournalRow(saved.journalRow);
        if(!oldRow.some(v=>v!==''&&v!=null)) throw new Error('Cette saisie n’existe plus dans Saisies App.');
        const oldAmount=Number(oldRow[4])||Number(saved.amount)||0;
        const dateISO=String(oldRow[1]||saved.date||presetISOFor(saved.tab));

        if(targetLabel===saved.label){
          const newTotal=src.total-oldAmount+amount;
          const rowVals=buildJournalRow({oldRow,dateISO,tab:saved.tab,label:saved.label,amount,note,cell:src.cell,col:src.col});
          await valuesBatch([
            {range:src.cell,values:[[Math.abs(newTotal)<0.005?0:newTotal]]},
            {range:`'${JOURNAL}'!A${saved.journalRow}:Q${saved.journalRow}`,values:[rowVals]}
          ]);
        }else{
          const dst=await snapshot(targetLabel,saved.tab,true);
          const srcNew=src.total-oldAmount;
          const dstNew=dst.total+amount;
          const rowVals=buildJournalRow({oldRow,dateISO,tab:saved.tab,label:targetLabel,amount,note,cell:dst.cell,col:dst.col});
          await valuesBatch([
            {range:src.cell,values:[[Math.abs(srcNew)<0.005?0:srcNew]]},
            {range:dst.cell,values:[[dstNew]]},
            {range:`'${JOURNAL}'!A${saved.journalRow}:Q${saved.journalRow}`,values:[rowVals]}
          ]);
          detailCache7521.delete(detailKey(targetLabel,saved.tab));
        }
      }else{
        /* Convert the historical residual into a tracked line. This preserves all
           existing App lines and makes future edits safe and individualised. */
        const rows=await journalRowsQ();
        const jr=freeJournalRow(rows);
        const newTotal=src.trackedTotal+amount;
        const dateISO=presetISOFor(saved.tab);
        const rowVals=buildJournalRow({dateISO,tab:saved.tab,label:saved.label,amount,note,cell:src.cell,col:src.col});
        await valuesBatch([
          {range:src.cell,values:[[newTotal]]},
          {range:`'${JOURNAL}'!A${jr}:Q${jr}`,values:[rowVals]}
        ]);
      }

      clearCaches(saved.label,saved.tab);
      if(targetLabel!==saved.label) clearCaches(targetLabel,saved.tab);
      closeEditor();
      toast(targetLabel!==saved.label?'✅ Depense deplacee et modifiee':'✅ Saisie modifiee');
      await loadCatDetail(targetLabel!==saved.label?targetLabel:saved.label,saved.tab,++detailSeq);
      try{renderMois();}catch(_){}
      try{renderDashboard();}catch(_){}
    }catch(e){
      const msg=String(e&&e.message||e);
      toast(msg.includes('429')?'Google Sheets limite temporairement les lectures. Attends quelques secondes puis reessaie.':'Erreur : '+msg,true);
    }finally{save.disabled=del.disabled=false;}
  }

  async function deleteEditor(){
    if(!editorState) return;
    const ov=ensureEditor(), save=ov.querySelector('.v7521-save'), del=ov.querySelector('.v7521-delete');
    if(!deleteArmed){
      deleteArmed=true;
      del.textContent='Confirmer la suppression';
      del.style.background='#C53B47';del.style.color='#fff';
      deleteTimer=setTimeout(resetDelete,5000);
      return;
    }

    const saved={...editorState};
    save.disabled=del.disabled=true;
    try{
      const src=await snapshot(saved.label,saved.tab,true);
      let expected;

      if(saved.kind==='app'){
        const oldRow=await freshJournalRow(saved.journalRow);
        if(!oldRow.some(v=>v!==''&&v!=null)) throw new Error('Cette saisie n’existe plus dans Saisies App.');
        const oldAmount=Number(oldRow[4])||Number(saved.amount)||0;
        expected=src.total-oldAmount;
        await valuesBatch([
          {range:src.cell,values:[[Math.abs(expected)<0.005?0:expected]]},
          {range:`'${JOURNAL}'!A${saved.journalRow}:Q${saved.journalRow}`,values:[new Array(17).fill('')]}
        ]);
      }else{
        expected=src.trackedTotal;
        await valuesUpdate(src.cell,expected);
      }

      const check=await readCellNumber(src.cell);
      const target=Math.abs(expected)<0.005?0:expected;
      if(Math.abs(check-target)>0.01) throw new Error('La suppression n’a pas ete confirmee par Google Sheets.');

      clearCaches(saved.label,saved.tab);
      closeEditor();
      toast('🗑 Saisie supprimee');
      await loadCatDetail(saved.label,saved.tab,++detailSeq);
      try{renderMois();}catch(_){}
      try{renderDashboard();}catch(_){}
    }catch(e){
      resetDelete();
      const msg=String(e&&e.message||e);
      toast(msg.includes('429')?'Google Sheets limite temporairement les lectures. Attends quelques secondes puis reessaie.':'Erreur suppression : '+msg,true);
    }finally{save.disabled=del.disabled=false;}
  }

  function addDetailRow(hist,item){
    const row=el('div','ent-row');
    const left=el('div');
    if(item.kind==='app'){
      left.appendChild(el('div','el',frDate(item.date)));
      if(item.note) left.appendChild(el('div','em',item.note));
      left.appendChild(el('div','v7521-source','Saisie App · detail conserve'));
    }else{
      left.appendChild(el('div','el','Montant historique Google Sheets'));
      left.appendChild(el('div','v7521-source','Historique du fichier · modifiable'));
    }
    row.appendChild(left);
    const right=document.createElement('div');right.className='v7521-right';
    right.appendChild(el('div','ea',fmtEUR(item.amount)));
    const acts=document.createElement('div');acts.className='v7521-actions';
    const edit=document.createElement('button');edit.type='button';edit.className='v7521-act';edit.textContent='✎';edit.setAttribute('aria-label','Modifier');
    const del=document.createElement('button');del.type='button';del.className='v7521-act v7521-del';del.textContent='🗑';del.setAttribute('aria-label','Supprimer');
    edit.onclick=e=>{e.preventDefault();e.stopPropagation();openEditor(item);};
    del.onclick=e=>{e.preventDefault();e.stopPropagation();openEditor(item);};
    acts.append(edit,del);right.appendChild(acts);row.appendChild(right);hist.appendChild(row);
  }

  /* Final detail renderer: one cell read + cached journal, no FORMULA parsing. */
  loadCatDetail=async function(label,tab,seq){
    const hist=$('#m-hist');
    try{
      const s=await snapshot(label,tab,false);
      if(seq!==detailSeq) return;
      $('#m-total').textContent=fmtEUR(s.total);
      hist.innerHTML='';
      $('#m-histnote').style.display='none';

      const items=[];
      if(Math.abs(s.historical)>=0.005){
        items.push({kind:'historical',label,tab,col:s.col,amount:s.historical,note:'',date:'',journalRow:null});
      }
      s.tracked.forEach(x=>items.push({
        kind:'app',label,tab,col:s.col,amount:Number(x.r[4])||0,
        date:String(x.r[1]||''),note:String(x.r[5]||''),journalRow:x.sheetRow
      }));

      $('#m-count').textContent=items.length?`${items.length} entree${items.length>1?'s':''}`:'';
      if(!items.length){hist.appendChild(el('p','muted','Aucune entree ce mois-ci.'));return;}
      items.forEach(it=>addDetailRow(hist,it));
    }catch(e){
      if(seq!==detailSeq) return;
      $('#m-total').textContent='—';hist.innerHTML='';
      const msg=String(e&&e.message||e);
      hist.appendChild(el('p','muted',msg.includes('429')?'Google Sheets limite temporairement les lectures. Patiente quelques secondes puis reouvre la categorie.':('Historique indisponible : '+msg)));
    }
  };

  /* Stable add: write total + individual journal row in the same batch. */
  writeEntry=async function({label,amtStr,dateISO,note,_interactive=true}){
    const d=new Date(dateISO+'T12:00:00');
    await loadMeta();
    let tab=tabTitleFor(d.getFullYear(),d.getMonth());
    if(!monthTabs.some(t=>t.y===d.getFullYear()&&t.m===d.getMonth()))
      tab=await createMonthFromTemplate(d.getFullYear(),d.getMonth(),_interactive);

    const info=await categoryInfo(tab,label);
    const amount=Number(amtStr);
    if(!Number.isFinite(amount)) throw new Error('Montant invalide.');
    await ensureJournal();
    const [current,rows]=await Promise.all([readCellNumber(info.cell),journalRowsQ()]);
    const jr=freeJournalRow(rows);
    const newTotal=current+amount;
    const rowVals=buildJournalRow({dateISO,tab,label,amount,note,cell:info.cell,col:info.col});
    await valuesBatch([
      {range:info.cell,values:[[newTotal]]},
      {range:`'${JOURNAL}'!A${jr}:Q${jr}`,values:[rowVals]}
    ]);
    clearCaches(label,tab);
    bumpUsage(label);
    return {tab,cell:info.cell,newTotal};
  };

  /* ---------- Recurring 44 EUR category from Nov 2026 ---------- */
  async function addTaxLabel(tab){
    const st=await getTabStructure(tab);
    if(st.map[TAX_LABEL]) return false;
    const sec=st.sections.find(s=>cleanSection(s.name)==='Logement')||st.sections.find(s=>s.name===SEC_NAMES[1]);
    if(!sec||!sec.subtotalRow) throw new Error('Section Logement introuvable.');
    await insertRowAt(tab,sec.subtotalRow);
    await valuesUpdate(`'${tab}'!A${sec.subtotalRow}`,TAX_LABEL,'RAW');
    delete structCache[tab];
    return true;
  }

  async function ensureTaxRecurring(){
    if(localStorage.getItem(TAX_MIGRATION_KEY)==='1') return;
    await loadMeta(true);
    if(!(await infraReady())) return;

    const changed=[];
    for(const t of monthTabs){
      if(t.y*12+t.m<TAX_START_ORD) continue;
      if(await addTaxLabel(t.title)) changed.push(t.title);
      const info=await categoryInfo(t.title,TAX_LABEL);
      await valuesUpdate(info.cell,TAX_AMOUNT);
    }
    if(meta&&meta.titles.includes(MODEL)){
      try{await addTaxLabel(MODEL);}catch(_){}
    }

    let ref=await valuesGet(`'${REF_CATS}'!A2:F`,'UNFORMATTED_VALUE');
    let rows=ref.values||[];
    let idx=rows.findIndex(r=>String(r[3]||'')===TAX_LABEL&&String(r[1]||'')==='Sortie');
    if(idx<0){
      await ensureReferenceEntry(SEC_NAMES[1],'Sortie','C',TAX_LABEL);
      ref=await valuesGet(`'${REF_CATS}'!A2:F`,'UNFORMATTED_VALUE');
      rows=ref.values||[];
      idx=rows.findIndex(r=>String(r[3]||'')===TAX_LABEL&&String(r[1]||'')==='Sortie');
    }
    if(idx>=0){
      const rr=idx+2;
      await valuesBatch([
        {range:`'${REF_CATS}'!E${rr}`,values:[[true]]},
        {range:`'${REF_CATS}'!F${rr}`,values:[[TAX_AMOUNT]]}
      ]);
    }

    for(const tab of changed){try{await syncMonthCategories(tab);}catch(_){}}
    invalidateCaches();
    gridSections=null;
    localStorage.setItem(TAX_MIGRATION_KEY,'1');
    try{renderCategories();}catch(_){}
  }

  const previousApplyRecurring=applyRecurringValues;
  applyRecurringValues=async function(tab){
    await previousApplyRecurring(tab);
    const ord=monthOrd(tab);
    if(ord==null) return;
    try{
      const info=await categoryInfo(tab,TAX_LABEL);
      await valuesUpdate(info.cell,ord>=TAX_START_ORD?TAX_AMOUNT:0);
    }catch(_){}
  };

  const previousOnAuthed=onAuthed;
  onAuthed=async function(){
    await previousOnAuthed();
    setTimeout(()=>ensureTaxRecurring().catch(e=>console.warn('Recurring tax migration skipped',e)),1500);
  };
})();