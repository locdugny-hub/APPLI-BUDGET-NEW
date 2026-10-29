/* Budget PWA v7.5.31
   - Adds precise expense categories without duplicating existing categories.
   - Migrates Modèle mois and all monthly sheets from January 2026 onward.
   - Preserves every existing amount and transaction; no historical reclassification is performed here.
*/
'use strict';

(function installV7531(){
  if(window.__budgetV7531) return;
  window.__budgetV7531=true;

  const MIGRATION_KEY='budget_categories_2026_v7531_done';
  const START_ORD=2026*12; // January 2026

  const NEW_CATEGORIES=[
    {section:'🏠 Logement', label:'🏠 Maison & équipement'},
    {section:'🏠 Logement', label:'🔨 Entretien & réparations logement'},
    {section:'🏠 Logement', label:'🏘️ Entretien & réparations logements locatifs'},
    {section:'🚗 Transport', label:'🅿️ Parking & stationnement'},
    {section:'🚗 Transport', label:'🛣️ Péages'},
    {section:'🛒 Vie courante', label:'✈️ Voyages & séjours'},
    {section:'🛒 Vie courante', label:'🩺 Santé'},
    {section:'🛒 Vie courante', label:'👕 Vêtements & accessoires'},
    {section:'🛒 Vie courante', label:'🤝 Dons & solidarité'},
    {section:'🛒 Vie courante', label:'📑 Frais administratifs & litiges'}
  ];

  function addFallbackCategory(section,label){
    const sec=SECTIONS.find(s=>s[0]===section);
    if(!sec) return;
    if(!sec[2].includes(label)) sec[2].push(label);
    CAT_INFO[label]={section,col:'C'};
  }
  NEW_CATEGORIES.forEach(x=>addFallbackCategory(x.section,x.label));

  async function ensureLabel(tab,section,label){
    const st=await getTabStructure(tab);
    if(st.map[label]) return false;
    const sec=st.sections.find(s=>s.name===section || cleanSection(s.name)===cleanSection(section));
    if(!sec || !sec.subtotalRow) throw new Error('Section introuvable pour '+label+' dans '+tab+'.');
    await insertRowAt(tab,sec.subtotalRow);
    await valuesUpdate(`'${tab}'!A${sec.subtotalRow}`,label,'RAW');
    delete structCache[tab];
    return true;
  }

  async function ensureReference(section,label){
    await ensureReferenceEntry(section,'Sortie','C',label);
  }

  async function runCategoryMigration(){
    if(localStorage.getItem(MIGRATION_KEY)==='1') return;
    await loadMeta(true);
    if(!(await infraReady())) return;

    const changed=new Set();
    const targets=(monthTabs||[]).filter(t=>t.y*12+t.m>=START_ORD);

    for(const t of targets){
      for(const item of NEW_CATEGORIES){
        if(await ensureLabel(t.title,item.section,item.label)) changed.add(t.title);
      }
    }

    if(meta && meta.titles && meta.titles.includes(MODEL)){
      for(const item of NEW_CATEGORIES){
        try{ await ensureLabel(MODEL,item.section,item.label); }catch(e){ console.warn('Model category migration',item.label,e); }
      }
    }

    for(const item of NEW_CATEGORIES) await ensureReference(item.section,item.label);

    for(const t of targets){
      try{ await syncMonthCategories(t.title); }catch(e){ console.warn('Index category sync',t.title,e); }
    }

    invalidateCaches();
    gridSections=null;
    for(const t of changed) delete monthCache[t];
    localStorage.setItem(MIGRATION_KEY,'1');

    try{ await loadMeta(true); }catch(_){}
    try{ renderCategories(); }catch(_){}
    try{ renderMois(); }catch(_){}
    try{ renderDashboard(); }catch(_){}
    toast('✅ Nouvelles catégories ajoutées au budget');
  }

  window.budgetRunCategoryMigrationV7531=runCategoryMigration;

  const previousOnAuthed=onAuthed;
  onAuthed=async function(){
    await previousOnAuthed();
    setTimeout(()=>runCategoryMigration().catch(e=>{
      console.warn('Budget category migration skipped',e);
      toast('Migration des catégories à terminer : '+(e&&e.message?e.message:e),true);
    }),1800);
  };
})();