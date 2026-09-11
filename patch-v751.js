/* Budget PWA v7.5.2
   Réparation robuste des onglets mensuels classiques.
   Détecte et reconstruit un mois invalide, répare Modèle mois et recrée les index.
*/
'use strict';

(function installMonthRepairV752(){
  if(window.__budgetMonthRepairV752) return;
  window.__budgetMonthRepairV752=true;

  const PRIMARY_TEMPLATE='Décembre 2026';

  async function sheetProps(){
    const r=await api('',{params:{fields:'sheets.properties(sheetId,title,index)'}});
    return (r.sheets||[]).map(s=>s.properties);
  }

  async function isClassicMonth(title){
    try{
      const data=await valuesGet(`'${title}'!A1:D120`,'UNFORMATTED_VALUE');
      const st=parseStructure(data.values||[]);
      return !!(st.sections && st.sections.length>=5 && Object.keys(st.map||{}).length>=10);
    }catch(_){ return false; }
  }

  async function findReferenceMonth(y,m,props){
    const primary=props.find(p=>p.title===PRIMARY_TEMPLATE);
    if(primary && await isClassicMonth(primary.title)) return primary;
    const target=y*12+m;
    const candidates=props.map(p=>{
      const d=parseMonthTitle(p.title);
      return d?{...p,y:d.y,m:d.m,ord:d.y*12+d.m}:null;
    }).filter(Boolean).sort((a,b)=>{
      const ab=a.ord<=target, bb=b.ord<=target;
      if(ab!==bb) return ab?-1:1;
      return ab ? b.ord-a.ord : a.ord-b.ord;
    });
    for(const p of candidates){ if(await isClassicMonth(p.title)) return p; }
    throw new Error('Aucun onglet mensuel classique utilisable comme modèle n’a été trouvé.');
  }

  async function ensureClassicModel(y,m){
    let props=await sheetProps();
    const model=props.find(p=>p.title===MODEL);
    if(model && await isClassicMonth(MODEL)) return model;

    const source=await findReferenceMonth(y,m,props);
    const modelIndex=model?model.index:props.length;
    const requests=[];
    if(model) requests.push({deleteSheet:{sheetId:model.sheetId}});
    requests.push({duplicateSheet:{sourceSheetId:source.sheetId,insertSheetIndex:modelIndex,newSheetName:MODEL}});
    await api(':batchUpdate',{method:'POST',body:{requests}});

    metaAt=0;
    delete structCache[MODEL];
    await loadMeta(true);
    props=await sheetProps();
    const rebuilt=props.find(p=>p.title===MODEL);
    if(!rebuilt || !(await isClassicMonth(MODEL))) throw new Error('Impossible de reconstruire le modèle mensuel classique.');
    return rebuilt;
  }

  async function deleteIndexedRows(sheetTitle,colLetter,target){
    try{
      const d=await valuesGet(`'${sheetTitle}'!${colLetter}2:${colLetter}`,'UNFORMATTED_VALUE');
      const rows=d.values||[], toDelete=[];
      rows.forEach((r,i)=>{ if(String((r||[])[0]||'')===target) toDelete.push(i+2); });
      if(!toDelete.length) return;
      const sid=await sheetIdOf(sheetTitle);
      const requests=toDelete.sort((a,b)=>b-a).map(R=>({deleteDimension:{range:{sheetId:sid,dimension:'ROWS',startIndex:R-1,endIndex:R}}}));
      await api(':batchUpdate',{method:'POST',body:{requests}});
    }catch(_){ }
  }

  async function resetIndexesForTab(tab){
    await deleteIndexedRows(INDEX_CATS,'D',tab);
    await deleteIndexedRows(INDEX_MONTHS,'D',tab);
  }

  async function repairExistingMonth(y,m){
    const tab=`${MONTHS_FR[m]} ${y}`;
    if(await isClassicMonth(tab)) return tab;

    let props=await sheetProps();
    if(!props.some(p=>p.title===tab)) return null;
    const model=await ensureClassicModel(y,m);
    props=await sheetProps();
    const target=props.find(p=>p.title===tab);
    if(!target) return null;

    await api(':batchUpdate',{method:'POST',body:{requests:[
      {deleteSheet:{sheetId:target.sheetId}},
      {duplicateSheet:{sourceSheetId:model.sheetId,insertSheetIndex:target.index,newSheetName:tab}}
    ]}});

    metaAt=0;
    delete structCache[tab];
    delete monthCache[tab];
    await loadMeta(true);
    await valuesUpdate(`'${tab}'!A1`,`${MONTHS_FR[m].toUpperCase()} ${y}`,'RAW');
    await applyRecurringValues(tab);
    await resetIndexesForTab(tab);
    await syncMonthIndex(tab);
    metaAt=0;
    await loadMeta(true);
    gridSections=null;
    toast(`✅ ${tab} réparé comme un mois classique`);
    return tab;
  }

  createMonthFromTemplate=async function(y,m,interactive=true){
    await loadMeta(true);
    const tab=`${MONTHS_FR[m]} ${y}`;
    if(monthTabs.some(t=>t.y===y&&t.m===m)){
      if(!(await isClassicMonth(tab))) return repairExistingMonth(y,m);
      return tabTitleFor(y,m);
    }
    if(!interactive) throw new Error(`L'onglet « ${tab} » n'existe pas encore.`);

    const titles=(await loadMeta(true)).titles||[];
    if(![INDEX_MONTHS,INDEX_CATS,REF_CATS].every(t=>titles.includes(t)))
      throw new Error('Le Google Sheet doit contenir les index techniques nécessaires.');

    const model=await ensureClassicModel(y,m);
    const props=await sheetProps();
    const insertSheetIndex=await v75InsertIndex(y,m,props);

    if(!confirm(`L'onglet « ${tab} » n'existe pas encore.\n\nLe créer maintenant comme un mois classique ?`))
      throw new Error('Création du mois annulée.');

    await api(':batchUpdate',{method:'POST',body:{requests:[{duplicateSheet:{sourceSheetId:model.sheetId,insertSheetIndex,newSheetName:tab}}]}});
    metaAt=0;
    await loadMeta(true);
    await valuesUpdate(`'${tab}'!A1`,`${MONTHS_FR[m].toUpperCase()} ${y}`,'RAW');
    delete structCache[tab];
    await applyRecurringValues(tab);
    await resetIndexesForTab(tab);
    await syncMonthIndex(tab);
    metaAt=0;
    await loadMeta(true);
    gridSections=null;
    toast(`✅ ${tab} créé comme un mois classique`);
    return tab;
  };

  const baseWriteEntry=writeEntry;
  writeEntry=async function(payload){
    const d=new Date(payload.dateISO+'T12:00:00');
    const y=d.getFullYear(),m=d.getMonth();
    await loadMeta(true);
    const tab=tabTitleFor(y,m);
    if(monthTabs.some(t=>t.y===y&&t.m===m) && !(await isClassicMonth(tab))){
      await repairExistingMonth(y,m);
    }
    return baseWriteEntry(payload);
  };
})();
