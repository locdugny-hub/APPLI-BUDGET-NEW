/* Budget PWA v7.5.5
   - Synchronise automatiquement les GID Google des onglets mensuels dans Index Mois!R
   - Permet au dashboard Google Sheet d'afficher des noms de mois propres tout en restant cliquables
   - Fonctionne aussi pour tout nouveau mois créé automatiquement par la PWA
*/
'use strict';

(function installV755(){
  if(window.__budgetV755) return;
  window.__budgetV755=true;

  async function syncMonthGids(){
    if(!(await infraReady())) return;
    await loadMeta(true);
    if(!sheetIds) return;

    const d=await valuesGet(`'${INDEX_MONTHS}'!D2:D`,'UNFORMATTED_VALUE');
    const rows=d.values||[];
    const writes=[{range:`'${INDEX_MONTHS}'!R1`,values:[['GID Google']]}];

    rows.forEach((r,i)=>{
      const title=String((r||[])[0]||'').trim();
      if(!title) return;
      const p=parseMonthTitle(title);
      if(!p) return;
      const gid=sheetIds[title];
      if(gid===undefined||gid===null) return;
      writes.push({range:`'${INDEX_MONTHS}'!R${i+2}`,values:[[Number(gid)]]});
    });

    if(writes.length>1) await valuesBatch(writes);
  }

  const previousSyncDetected=syncDetectedMonthsToIndexes;
  syncDetectedMonthsToIndexes=async function(){
    await previousSyncDetected();
    try{ await syncMonthGids(); }
    catch(e){ console.warn('Synchronisation GID ignorée',e); }
  };

  const previousSyncMonthIndex=syncMonthIndex;
  syncMonthIndex=async function(tab){
    const result=await previousSyncMonthIndex(tab);
    try{ await syncMonthGids(); }
    catch(e){ console.warn('Synchronisation GID du mois ignorée',e); }
    return result;
  };

  window.syncMonthGids=syncMonthGids;
})();
