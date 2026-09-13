/* Budget PWA v7.5.13
   - Corrige le bug de connexion Face ID au premier lancement a froid sur iOS
   - Retarde l'auto Face ID jusqu'a ce que la PWA soit visible, focussee et stable
   - Evite la course entre WebAuthn et la reprise OAuth Google
*/
'use strict';

(function installV7513(){
  if(window.__budgetV7513) return;
  window.__budgetV7513=true;

  let autoBioTimer=null;
  let bioSettling=false;
  let pageReady=(document.readyState==='complete');
  window.addEventListener('load',()=>{ pageReady=true; },{once:true});

  function canStartBio(){
    return pageReady && !document.hidden && document.hasFocus && document.hasFocus() &&
      lock.mode==='verify' && bioSupport && bioEnabled() && $('#lock') && $('#lock').classList.contains('open');
  }

  function scheduleAutoBio(delay=1200){
    if(autoBioTimer) clearTimeout(autoBioTimer);
    autoBioTimer=setTimeout(()=>{
      autoBioTimer=null;
      if(canStartBio() && !lock.bioTried){
        lock.bioTried=true;
        tryBioUnlock();
      }
    },delay);
  }

  /* Remplace la tentative automatique trop precoce (350 ms) de la version de base. */
  syncLockBio=function(auto){
    const show=lock.mode==='verify'&&bioSupport&&bioEnabled()&&$('#lock')&&$('#lock').classList.contains('open');
    const kb=$('#key-bio');
    if(kb) kb.style.visibility=show?'visible':'hidden';
    if(show){
      const sub=$('#lock-sub');
      if(sub) sub.textContent='Face ID ou code a 6 chiffres';
      if(auto&&!lock.bioTried) scheduleAutoBio(pageReady?900:1400);
    }
  };

  tryBioUnlock=async function(){
    if(bioBusy||bioSettling||lock.mode!=='verify'||!bioEnabled()||!$('#lock')||!$('#lock').classList.contains('open')) return;
    if(document.hidden) return;

    bioBusy=true;
    try{
      const ok=await bioAssert();
      if(!ok) return;

      const cb=lock.onDone;
      bioSettling=true;
      hideLock();
      lock.busy=false;

      /*
       * iOS a besoin d'un court temps apres la fermeture de la feuille Face ID.
       * On attend avant de lancer restore token / OAuth Google.
       */
      setTimeout(()=>{
        bioBusy=false;
        bioSettling=false;
        try{
          const r=cb&&cb();
          if(r&&typeof r.catch==='function') r.catch(()=>{});
        }catch(_){ }
      },450);
    }catch(_){
      const sub=$('#lock-sub');
      if(sub) sub.textContent='Face ID ou code a 6 chiffres';
      bioSettling=false;
    }finally{
      if(!bioSettling) bioBusy=false;
    }
  };

  /* Si la PWA vient juste d'apparaitre, ne relance pas Face ID instantanement. */
  function resumeBio(){
    if(document.hidden) return;
    bioBusy=false;
    lock.busy=false;
    if($('#lock')&&$('#lock').classList.contains('open')&&lock.mode==='verify'&&bioEnabled()){
      if(!lock.bioTried) scheduleAutoBio(900);
      else syncLockBio(false);
    }
  }

  window.addEventListener('pageshow',()=>setTimeout(resumeBio,250));
  window.addEventListener('focus',()=>setTimeout(resumeBio,250));
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) setTimeout(resumeBio,250); });
})();
