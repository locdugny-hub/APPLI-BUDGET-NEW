/* Budget PWA v7.5.19
   - Suppression robuste et vérifiée des saisies
   - Ecriture atomique cellule + journal
   - Relecture Google Sheets avant confirmation utilisateur
   - Confirmation intégrée au panneau, sans confirm() natif iOS
*/
'use strict';

(function installV7519(){
  if(window.__budgetV7519) return;
  window.__budgetV7519=true;

  let deleteArmed=false;
  let deleteTimer=null;

  function resetDeleteButton(){
    deleteArmed=false;
    if(deleteTimer){ clearTimeout(deleteTimer); deleteTimer=null; }
    const ov=document.getElementById('v7518-overlay');
    const b=ov&&ov.querySelector('.v7518-delete');
    if(b){
      b.textContent='Supprimer';
      b.style.background='#FFF7F8';
      b.style.color='#C53B47';
    }
  }

  function sameFormula(a,b){
    return String(a==null?'':a).replace(/\s+/g,'').trim()===String(b==null?'':b).replace(/\s+/g,'').trim();
  }

  async function verifiedDelete(){
    if(!current) return;
    const saved={...current};
    const ov=document.getElementById('v7518-overlay');
    const save=ov.querySelector('.v7518-save');
    const del=ov.querySelector('.v7518-delete');

    if(!deleteArmed){
      deleteArmed=true;
      del.textContent='Confirmer la suppression';
      del.style.background='#C53B47';
      del.style.color='#fff';
      if(deleteTimer) clearTimeout(deleteTimer);
      deleteTimer=setTimeout(resetDeleteButton,5000);
      return;
    }

    save.disabled=del.disabled=true;
    try{
      const ctx=await contextFor(saved.label,saved.tab);
      let item=null;

      /* Priorité à la position exacte encore valide. C'est plus sûr quand deux montants
         identiques existent dans la même catégorie. */
      if(Number.isInteger(saved.index) && ctx.meta[saved.index] && ctx.meta[saved.index].term.num!=null){
        const candidate=ctx.meta[saved.index];
        const sameAmount=Math.abs(Math.abs(Number(candidate.term.num))-Number(saved.amount||0))<0.005;
        const sameJournal=!saved.journalRow || (candidate.journal&&candidate.journal.sheetRow===saved.journalRow);
        if(sameAmount&&sameJournal) item=candidate;
      }
      if(!item) item=findFreshItem(ctx,saved);
      if(!item) throw new Error('Saisie introuvable après actualisation.');

      const before=await valuesGet(ctx.cell,'FORMULA');
      const beforeRaw=(before.values&&before.values[0]&&before.values[0][0]!==undefined)?before.values[0][0]:'';
      const next=formulaFromTerms(ctx.terms,item.index,-1,'');

      const writes=[{range:ctx.cell,values:[[next]]}];
      if(item.kind==='app'&&item.journal){
        writes.push({range:`'${JOURNAL}'!A${item.journal.sheetRow}:Q${item.journal.sheetRow}`,values:[new Array(17).fill('')]});
      }
      await valuesBatch(writes);

      /* Contrôle réel côté Google Sheets avant d'afficher le succès. */
      const check=await valuesGet(ctx.cell,'FORMULA');
      const afterRaw=(check.values&&check.values[0]&&check.values[0][0]!==undefined)?check.values[0][0]:'';
      if(sameFormula(beforeRaw,afterRaw)){
        throw new Error('Google Sheets n’a pas appliqué la suppression.');
      }

      const afterTerms=(parseFormulaTerms(afterRaw,ctx.sep).terms||[]);
      if(afterTerms.length>=ctx.terms.length){
        throw new Error('La suppression n’a pas été confirmée par Google Sheets.');
      }

      resetDeleteButton();
      closeEditor();
      delete monthCache[saved.tab];
      journalCache=null;
      lastSync=Date.now();
      toast('🗑 Saisie supprimée');

      const seq=++detailSeq;
      await loadCatDetail(saved.label,saved.tab,seq);
      try{ if(typeof renderMonth==='function') renderMonth(); }catch(_){}
      try{ if(typeof renderDashboard==='function') renderDashboard(); }catch(_){}
    }catch(e){
      resetDeleteButton();
      toast('Erreur suppression : '+e.message,true);
    }finally{
      save.disabled=del.disabled=false;
    }
  }

  const oldEnsure=ensureEditor;
  ensureEditor=function(){
    const ov=oldEnsure();
    const del=ov.querySelector('.v7518-delete');
    del.onclick=verifiedDelete;
    return ov;
  };

  const oldOpen=openEditor;
  openEditor=function(label,tab,item){
    oldOpen(label,tab,item);
    resetDeleteButton();
    const ov=document.getElementById('v7518-overlay');
    if(ov) ov.querySelector('.v7518-delete').onclick=verifiedDelete;
  };
})();