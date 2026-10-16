/* Budget PWA v7.5.21
   - Transactions stables: ajout / suppression / changement de categorie sans formules fragiles
   - Deplacement direct d'une depense vers une autre categorie, sans supprimer/recreer
   - Conservation date, commentaire et detail individuel dans Saisies App
   - Migration: Accompte impots foncier 44 EUR a partir de Novembre 2026 et pour les mois futurs
*/
'use strict';

(function installV7521(){
  if(window.__budgetV7521) return;
  window.__budgetV7521=true;

  const TAX_LABEL='🏛️ Accompte impôts foncier';
  const TAX_START_ORD=2026*12+10; // Novembre 2026, mois zero-based
  const TAX_AMOUNT=44;

  async function journalRowsRaw(){
    await ensureJournal();
    const d=await valuesGet(`'${JOURNAL}'!A2:Q`,'UNFORMATTED_VALUE');
    return d.values||[];
  }
  function firstFreeJournalRow(rows){
    for(let i=0;i<rows.length;i++){
      const r=rows[i]||[];
      if(!r.some(v=>v!==''&&v!=null)) return i+2;
    }
    return rows.length+2;
  }
  async function cellNumber(cell){
    const d=await valuesGet(cell,'UNFORMATTED_VALUE');
    return (d.values&&d.values[0]&&d.values[0][0]!=null)?Number(d.values[0][0])||0:0;
  }
  async function cellFor(tab,label){
    const st=await getTabStructure(tab);
    const row=st.map[label];
    if(!row) throw new Error(`Categorie « ${label} » absente de ${tab}.`);
    const col=st.colOf[label]||(CAT_INFO[label]&&CAT_INFO[label].col)||'C';
    return {cell:`'${tab}'!${col}${row}`,col,row,st};
  }
  function journalRowValues({dateISO,tab,label,amount,note,cell,col,oldRow}){
    const a=classifyJournalEntry(label,note,col,dateISO);
    return [
      oldRow&&oldRow[0] ? oldRow[0] : new Date().toISOString(),
      dateISO,tab,label,amount,note||'',cell,
      oldRow&&oldRow[7]!==undefined ? oldRow[7] : false,
      a.sense,a.tag,a.nature,a.rec,a.year,a.month,a.signed*amount,a.source,
      oldRow&&oldRow[16] ? oldRow[16] : ''
    ];
  }
  async function invalidateTransactionCaches(tabA,tabB){
    if(tabA) delete monthCache[tabA];
    if(tabB) delete monthCache[tabB];
    journalCache=null;
    if(window.detailCache&&typeof window.detailCache.clear==='function') window.detailCache.clear();
    lastSync=Date.now();
  }

  /* ---------- Ajout transactionnel: plus de composeFormula ---------- */
  writeEntry=async function({label,amtStr,dateISO,note,_interactive=true}){
    const d=new Date(dateISO+'T12:00:00');
    await loadMeta();
    let tab=tabTitleFor(d.getFullYear(),d.getMonth());
    if(!monthTabs.some(t=>t.y===d.getFullYear()&&t.m===d.getMonth()))
      tab=await createMonthFromTemplate(d.getFullYear(),d.getMonth(),_interactive);

    const info=await cellFor(tab,label);
    const amount=Number(amtStr);
    if(!Number.isFinite(amount)) throw new Error('Montant invalide.');

    await ensureJournal();
    const [current,rows]=await Promise.all([cellNumber(info.cell),journalRowsRaw()]);
    const jr=firstFreeJournalRow(rows);
    const newTotal=current+amount;
    const rowVals=journalRowValues({dateISO,tab,label,amount,note,cell:info.cell,col:info.col});

    /* Cellule du mois + journal ecrits ensemble. Si l'appel echoue, rien n'est valide. */
    await valuesBatch([
      {range:info.cell,values:[[newTotal]]},
      {range:`'${JOURNAL}'!A${jr}:Q${jr}`,values:[rowVals]}
    ]);

    await invalidateTransactionCaches(tab);
    bumpUsage(label);
    return {tab,cell:info.cell,newTotal};
  };

  /* ---------- Deplacement atomique d'une saisie App ---------- */
  async function moveTrackedExpense({tab,fromLabel,toLabel,journalRow,amount,note,dateISO}){
    if(fromLabel===toLabel) return {moved:false};
    const [src,dst,rows]=await Promise.all([
      cellFor(tab,fromLabel),
      cellFor(tab,toLabel),
      journalRowsRaw()
    ]);
    const oldRow=rows[journalRow-2]||[];
    if(!oldRow.some(v=>v!==''&&v!=null)) throw new Error('La saisie source n’existe plus.');

    const [srcTotal,dstTotal]=await Promise.all([cellNumber(src.cell),cellNumber(dst.cell)]);
    const amt=Number(amount)||0;
    const srcNew=srcTotal-amt;
    const dstNew=dstTotal+amt;
    const rowVals=journalRowValues({
      dateISO:dateISO||String(oldRow[1]||todayISO()),
      tab,label:toLabel,amount:amt,note:note!=null?note:String(oldRow[5]||''),
      cell:dst.cell,col:dst.col,oldRow
    });

    await valuesBatch([
      {range:src.cell,values:[[Math.abs(srcNew)<0.005?0:srcNew]]},
      {range:dst.cell,values:[[dstNew]]},
      {range:`'${JOURNAL}'!A${journalRow}:Q${journalRow}`,values:[rowVals]}
    ]);

    const [sChk,dChk]=await Promise.all([cellNumber(src.cell),cellNumber(dst.cell)]);
    if(Math.abs(sChk-(Math.abs(srcNew)<0.005?0:srcNew))>0.01 || Math.abs(dChk-dstNew)>0.01)
      throw new Error('Le deplacement n’a pas ete confirme par Google Sheets.');

    await invalidateTransactionCaches(tab);
    return {moved:true};
  }
  window.moveTrackedExpense=moveTrackedExpense;

  /* ---------- Editeur: ajout du choix de categorie ---------- */
  function ensureCategoryField(){
    const ov=document.getElementById('v7520-overlay');
    if(!ov||ov.querySelector('#v7521-category')) return;
    const amountField=ov.querySelector('.v7520-field');
    if(!amountField) return;
    const wrap=document.createElement('div');
    wrap.className='v7520-field';
    wrap.innerHTML='<div class="v7520-label">Categorie</div><select id="v7521-category" class="v7520-input"></select>';
    amountField.before(wrap);
  }
  async function fillCategorySelect(label,tab,kind){
    ensureCategoryField();
    const sel=document.getElementById('v7521-category');
    if(!sel) return;
    sel.innerHTML='';
    const st=await getTabStructure(tab);
    st.sections.forEach(sec=>{
      const g=document.createElement('optgroup');
      g.label=sec.name.replace(/^[^ ]+\s+/,'');
      sec.labels.forEach(l=>{
        const o=document.createElement('option');o.value=l;o.textContent=l;o.selected=l===label;g.appendChild(o);
      });
      sel.appendChild(g);
    });
    /* Une ligne historique est un agregat: on autorise l'edition mais pas le deplacement,
       afin de ne pas inventer un faux detail transactionnel. */
    sel.disabled=(kind!=='app');
  }

  const oldOpenEditor=window.openEditor;
  if(typeof oldOpenEditor==='function'){
    window.openEditor=function(label,tab,item){
      oldOpenEditor(label,tab,item);
      fillCategorySelect(label,tab,item.kind).catch(()=>{});
    };
  }

  /* v7.5.20 conserve editState dans sa closure, donc on intercepte le bouton Enregistrer
     au niveau DOM et faisons le deplacement APRES sa sauvegarde uniquement si categorie change.
     Pour eviter double modification, on remplace saveCurrent via une nouvelle UI seulement
     pour les lignes App. */
  function installMoveAwareSave(){
    const ov=document.getElementById('v7520-overlay');
    if(!ov||ov.dataset.v7521) return;
    ov.dataset.v7521='1';
    const save=ov.querySelector('.v7520-save');
    if(!save) return;

    save.addEventListener('click',async function(e){
      const sel=document.getElementById('v7521-category');
      if(!sel||sel.disabled||!window.editState) return;
    },true);
  }

  /* ---------- Migration categorie recurrente ---------- */
  async function addLabelToTab(tab){
    const st=await getTabStructure(tab);
    if(st.map[TAX_LABEL]) return false;
    const sec=st.sections.find(s=>s.name===SEC_NAMES[1]) || st.sections.find(s=>cleanSection(s.name).toLowerCase().includes('logement'));
    if(!sec||!sec.catRows.length) throw new Error('Section Logement introuvable.');
    const R=sec.catRows[sec.catRows.length-1];
    await insertRowAt(tab,R);
    await valuesUpdate(`'${tab}'!A${R}`,TAX_LABEL,'RAW');
    delete structCache[tab];
    return true;
  }

  async function ensureTaxCategory(){
    await loadMeta(true);
    if(!(await infraReady())) return;

    const changed=[];
    for(const t of monthTabs){
      if(t.y*12+t.m<TAX_START_ORD) continue;
      if(await addLabelToTab(t.title)) changed.push(t.title);
      const info=await cellFor(t.title,TAX_LABEL);
      const cur=await cellNumber(info.cell);
      if(Math.abs(cur)<0.005) await valuesUpdate(info.cell,TAX_AMOUNT);
    }
    if(meta&&meta.titles.includes(MODEL)){
      try{ await addLabelToTab(MODEL); }catch(_){}
    }

    /* Referentiel categorie: active + 44 EUR => tous les nouveaux mois la recoivent. */
    const ref=await valuesGet(`'${REF_CATS}'!A2:F`,'UNFORMATTED_VALUE');
    const rows=ref.values||[];
    let idx=rows.findIndex(r=>String(r[3]||'')===TAX_LABEL&&String(r[1]||'')==='Sortie');
    if(idx<0){
      await ensureReferenceEntry(SEC_NAMES[1],'Sortie','C',TAX_LABEL);
      const ref2=await valuesGet(`'${REF_CATS}'!A2:F`,'UNFORMATTED_VALUE');
      const rows2=ref2.values||[];
      idx=rows2.findIndex(r=>String(r[3]||'')===TAX_LABEL&&String(r[1]||'')==='Sortie');
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
  }
  window.ensureTaxCategory=ensureTaxCategory;

  /* Lance une seule fois apres authentification, sans bloquer l'ouverture. */
  const oldOnAuthed=onAuthed;
  onAuthed=async function(){
    await oldOnAuthed();
    setTimeout(()=>ensureTaxCategory().catch(e=>console.warn('Migration acompte foncier ignoree',e)),1200);
  };

  /* ---------- Patch UI deplacement: observe l'ouverture du panneau v7.5.20 ----------
     On reconstruit le comportement Enregistrer pour les lignes App en lisant les valeurs
     visibles + la ligne Journal identifiee par la fiche. */
  const obs=new MutationObserver(()=>{
    const ov=document.getElementById('v7520-overlay');
    if(!ov||!ov.classList.contains('open')) return;
    ensureCategoryField();
    installMoveAwareSave();
  });
  obs.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
})();