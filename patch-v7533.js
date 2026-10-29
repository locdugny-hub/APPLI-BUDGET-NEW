/* Budget PWA v7.5.33
   Batched, resumable category migration to stay below Google Sheets write quotas.
*/
'use strict';

(function installV7533(){
  if(window.__budgetV7533) return;
  window.__budgetV7533=true;

  const START_ORD=2026*12;
  const MIGRATION_KEY='budget_categories_2026_v7533_verified';
  const CATS=[
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

  let running=false;

  function addFallbacks(){
    if(typeof SECTIONS==='undefined'||typeof CAT_INFO==='undefined') return;
    for(const item of CATS){
      const sec=SECTIONS.find(s=>s[0]===item.section);
      if(sec&&!sec[2].includes(item.label)) sec[2].push(item.label);
      CAT_INFO[item.label]={section:item.section,col:'C'};
    }
  }

  async function sheetIdMap(){
    const m=await api('',{params:{fields:'sheets.properties(sheetId,title)'}});
    const out={};
    (m.sheets||[]).forEach(s=>{if(s&&s.properties) out[s.properties.title]=s.properties.sheetId;});
    return out;
  }

  async function planSheet(tab,sheetId){
    const st=await getTabStructure(tab);
    const groups=[];
    for(const section of ['🏠 Logement','🚗 Transport','🛒 Vie courante']){
      const sec=st.sections.find(s=>s.name===section||cleanSection(s.name)===cleanSection(section));
      if(!sec||!sec.subtotalRow) continue;
      const missing=CATS.filter(x=>x.section===section&&!st.map[x.label]);
      if(missing.length) groups.push({tab,sheetId,section,row:sec.subtotalRow,missing});
    }
    return groups;
  }

  async function migrate(){
    if(running) return;
    if(localStorage.getItem(MIGRATION_KEY)==='1') return;
    if(typeof api!=='function'||typeof loadMeta!=='function'||!accessToken) return;
    running=true;
    try{
      addFallbacks();
      await loadMeta(true);
      if(typeof infraReady==='function' && !(await infraReady())) throw new Error('Infrastructure technique indisponible');

      const ids=await sheetIdMap();
      const targets=(monthTabs||[]).filter(t=>t.y*12+t.m>=START_ORD).map(t=>t.title);
      if(meta&&meta.titles&&meta.titles.includes(MODEL)) targets.push(MODEL);

      const groups=[];
      for(const tab of targets){
        const sid=ids[tab];
        if(sid==null) continue;
        const p=await planSheet(tab,sid);
        groups.push(...p);
      }

      /* Insert all missing rows with ONE spreadsheet batchUpdate.
         Process each sheet from bottom to top so upper row indexes remain stable. */
      const requests=[];
      const ordered=[...groups].sort((a,b)=>a.sheetId===b.sheetId?b.row-a.row:a.sheetId-b.sheetId);
      for(const g of ordered){
        requests.push({insertDimension:{range:{
          sheetId:g.sheetId,dimension:'ROWS',
          startIndex:g.row-1,endIndex:g.row-1+g.missing.length
        },inheritFromBefore:true}});
      }
      if(requests.length) await api(':batchUpdate',{method:'POST',body:{requests}});

      /* Write all labels with ONE values.batchUpdate. */
      const writes=[];
      for(const g of groups){
        g.missing.forEach((item,i)=>{
          writes.push({range:`'${g.tab}'!A${g.row+i}`,values:[[item.label]]});
        });
      }
      if(writes.length) await valuesBatch(writes);

      /* Clear structure caches after the structural write. */
      targets.forEach(t=>{delete structCache[t]; delete monthCache[t];});

      /* Reference rows: ensureReferenceEntry is idempotent.
         Only ten categories, but pace them to avoid quota spikes if a previous attempt just ran. */
      for(const item of CATS){
        await ensureReferenceEntry(item.section,'Sortie','C',item.label);
        await new Promise(r=>setTimeout(r,180));
      }

      /* Index synchronization: one month at a time with a short pause.
         This is resumable and idempotent. */
      for(const t of (monthTabs||[]).filter(t=>t.y*12+t.m>=START_ORD)){
        await syncMonthCategories(t.title);
        await new Promise(r=>setTimeout(r,250));
      }

      /* Hard verification on October 2026 when present. */
      const check=(monthTabs||[]).find(t=>t.y===2026&&t.m===9) || (monthTabs||[]).find(t=>t.y*12+t.m>=START_ORD);
      if(check){
        delete structCache[check.title];
        const st=await getTabStructure(check.title);
        const missing=CATS.filter(x=>!st.map[x.label]);
        if(missing.length) throw new Error('Catégories manquantes après migration : '+missing.map(x=>x.label).join(', '));
      }

      invalidateCaches();
      gridSections=null;
      localStorage.setItem(MIGRATION_KEY,'1');
      localStorage.setItem('budget_categories_2026_v7532_verified','1');
      localStorage.setItem('budget_categories_2026_v7531_done','1');
      try{renderCategories();}catch(_){}
      try{renderMois();}catch(_){}
      try{renderDashboard();}catch(_){}
      toast('✅ Migration catégories terminée');
    }catch(e){
      const msg=String(e&&e.message||e);
      console.warn('Batched category migration',e);
      if(msg.includes('429')){
        toast('Google limite encore les écritures. Nouvelle tentative automatique au prochain rafraîchissement.',true);
      }else{
        toast('Migration catégories : '+msg,true);
      }
    }finally{
      running=false;
    }
  }

  addFallbacks();
  window.budgetRunCategoryMigrationV7533=migrate;

  function schedule(){
    setTimeout(()=>migrate(),2500);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&localStorage.getItem(MIGRATION_KEY)!=='1') setTimeout(()=>migrate(),1200);
  });
})();