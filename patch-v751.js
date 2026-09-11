/* Budget PWA v7.5.1
   Correctif création de mois : garantit qu'un nouveau mois est un vrai onglet mensuel classique.
   Le modèle technique "Modèle mois" est réparé automatiquement à partir d'un vrai mois de référence.
*/
'use strict';

const V751_PRIMARY_TEMPLATE='Décembre 2026';

async function v751SheetProps(){
  const r=await api('',{params:{fields:'sheets.properties(sheetId,title,index)'}});
  return (r.sheets||[]).map(s=>s.properties);
}

async function v751IsClassicMonth(title){
  try{
    const data=await valuesGet(`'${title}'!A1:D120`,'UNFORMATTED_VALUE');
    const rows=data.values||[];
    const st=parseStructure(rows);
    return st.sections && st.sections.length>=5 && Object.keys(st.map||{}).length>=10;
  }catch(_){ return false; }
}

async function v751FindReferenceMonth(y,m,props){
  const primary=props.find(p=>p.title===V751_PRIMARY_TEMPLATE);
  if(primary && await v751IsClassicMonth(primary.title)) return primary;

  const target=y*12+m;
  const candidates=props.map(p=>{
    const d=parseMonthTitle(p.title);
    return d?{...p,y:d.y,m:d.m,ord:d.y*12+d.m}:null;
  }).filter(Boolean).sort((a,b)=>{
    const aBefore=a.ord<=target, bBefore=b.ord<=target;
    if(aBefore!==bBefore) return aBefore?-1:1;
    if(aBefore) return b.ord-a.ord;
    return a.ord-b.ord;
  });
  for(const p of candidates){
    if(await v751IsClassicMonth(p.title)) return p;
  }
  throw new Error('Aucun onglet mensuel classique utilisable comme modèle n’a été trouvé.');
}

async function v751EnsureClassicModel(y,m){
  let props=await v751SheetProps();
  const model=props.find(p=>p.title===MODEL);
  if(model && await v751IsClassicMonth(MODEL)) return model;

  const source=await v751FindReferenceMonth(y,m,props);
  const modelIndex=model?model.index:props.length;
  const requests=[];
  if(model) requests.push({deleteSheet:{sheetId:model.sheetId}});
  requests.push({duplicateSheet:{sourceSheetId:source.sheetId,insertSheetIndex:modelIndex,newSheetName:MODEL}});

  await api(':batchUpdate',{method:'POST',body:{requests}});
  metaAt=0;
  delete structCache[MODEL];
  await loadMeta(true);
  props=await v751SheetProps();
  const rebuilt=props.find(p=>p.title===MODEL);
  if(!rebuilt || !(await v751IsClassicMonth(MODEL)))
    throw new Error('Impossible de reconstruire le modèle mensuel classique.');
  return rebuilt;
}

createMonthFromTemplate=async function(y,m,interactive=true){
  await loadMeta(true);
  const tab=`${MONTHS_FR[m]} ${y}`;
  if(monthTabs.some(t=>t.y===y&&t.m===m)) return tabTitleFor(y,m);
  if(!interactive) throw new Error(`L'onglet « ${tab} » n'existe pas encore.`);

  if(!(await infraReady())) throw new Error('Le Google Sheet doit contenir les index techniques nécessaires.');

  const model=await v751EnsureClassicModel(y,m);
  const props=await v751SheetProps();
  const insertSheetIndex=await v75InsertIndex(y,m,props);

  if(!confirm(`L'onglet « ${tab} » n'existe pas encore.\n\nLe créer maintenant comme un mois classique ?`))
    throw new Error('Création du mois annulée.');

  await api(':batchUpdate',{
    method:'POST',
    body:{requests:[{duplicateSheet:{sourceSheetId:model.sheetId,insertSheetIndex,newSheetName:tab}}]}
  });

  metaAt=0;
  await loadMeta(true);
  await valuesUpdate(`'${tab}'!A1`,`${MONTHS_FR[m].toUpperCase()} ${y}`,'RAW');
  delete structCache[tab];

  /* Les valeurs récurrentes du référentiel restent prioritaires si elles existent. */
  await applyRecurringValues(tab);
  await syncMonthIndex(tab);

  metaAt=0;
  await loadMeta(true);
  gridSections=null;
  toast(`✅ ${tab} créé comme un mois classique`);
  return tab;
};
