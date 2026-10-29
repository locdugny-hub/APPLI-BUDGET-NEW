/* Budget PWA v7.5.32
   Forced direct category migration loader.
   Loaded from index.html so it is not dependent on the service worker's patched app.js bundle.
*/
'use strict';

(function installV7532(){
  if(window.__budgetV7532) return;
  window.__budgetV7532=true;

  const START_ORD=2026*12;
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

  let running=false, done=false, attempts=0;

  function addFallbacks(){
    if(typeof SECTIONS==='undefined'||typeof CAT_INFO==='undefined') return;
    NEW_CATEGORIES.forEach(x=>{
      const sec=SECTIONS.find(s=>s[0]===x.section);
      if(sec&&!sec[2].includes(x.label)) sec[2].push(x.label);
      CAT_INFO[x.label]={section:x.section,col:'C'};
    });
  }

  async function ensureLabel(tab,item){
    const st=await getTabStructure(tab);
    if(st.map[item.label]) return false;
    const sec=st.sections.find(s=>s.name===item.section || cleanSection(s.name)===cleanSection(item.section));
    if(!sec||!sec.subtotalRow) throw new Error('Section '+item.section+' introuvable dans '+tab);
    await insertRowAt(tab,sec.subtotalRow);
    await valuesUpdate(`'${tab}'!A${sec.subtotalRow}`,item.label,'RAW');
    delete structCache[tab];
    return true;
  }

  async function verifyTarget(tab){
    const st=await getTabStructure(tab);
    return NEW_CATEGORIES.every(x=>!!st.map[x.label]);
  }

  async function migrate(){
    if(running||done) return;
    if(typeof api!=='function'||typeof loadMeta!=='function'||typeof getTabStructure!=='function') return;
    if(!accessToken) return;
    running=true;
    try{
      addFallbacks();
      await loadMeta(true);
      if(typeof infraReady==='function' && !(await infraReady())) throw new Error('Infrastructure technique indisponible');
      const targets=(monthTabs||[]).filter(t=>t.y*12+t.m>=START_ORD);

      for(const t of targets){
        for(const item of NEW_CATEGORIES) await ensureLabel(t.title,item);
      }
      if(meta&&meta.titles&&meta.titles.includes(MODEL)){
        for(const item of NEW_CATEGORIES) await ensureLabel(MODEL,item);
      }

      for(const item of NEW_CATEGORIES){
        await ensureReferenceEntry(item.section,'Sortie','C',item.label);
      }
      for(const t of targets){
        try{ await syncMonthCategories(t.title); }catch(e){ console.warn('syncMonthCategories',t.title,e); }
      }

      // Verify October 2026 when present, otherwise verify current month target.
      const check=(monthTabs||[]).find(t=>t.y===2026&&t.m===9) || targets[targets.length-1];
      if(check && !(await verifyTarget(check.title))) throw new Error('Vérification des nouvelles catégories incomplète');

      invalidateCaches();
      gridSections=null;
      targets.forEach(t=>{ delete monthCache[t.title]; });
      try{renderCategories();}catch(_){}
      try{renderMois();}catch(_){}
      try{renderDashboard();}catch(_){}
      done=true;
      localStorage.setItem('budget_categories_2026_v7532_verified','1');
      toast('✅ Catégories budget ajoutées et vérifiées');
    }catch(e){
      console.warn('Forced category migration',e);
      if(attempts>=12) toast('Migration catégories : '+(e&&e.message?e.message:e),true);
    }finally{
      running=false;
    }
  }

  function schedule(){
    const timer=setInterval(()=>{
      attempts++;
      if(done||attempts>15){ clearInterval(timer); return; }
      migrate();
    },1500);
    setTimeout(()=>migrate(),300);
  }

  addFallbacks();

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();

  const previousFullRefresh=window.fullRefresh;
  if(typeof previousFullRefresh==='function'){
    window.fullRefresh=async function(){
      const r=await previousFullRefresh.apply(this,arguments);
      done=false;
      await migrate();
      return r;
    };
  }

  window.budgetRunCategoryMigrationV7532=async()=>{done=false;attempts=0;await migrate();};
})();