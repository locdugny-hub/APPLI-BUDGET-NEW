/* Budget PWA v7.5.12
   - Header mobile non sticky
   - Robustesse Face ID / Touch ID iOS au retour de WebAuthn
*/
'use strict';

(function installV7512(){
  if(window.__budgetV7512) return;
  window.__budgetV7512=true;

  const style=document.createElement('style');
  style.textContent=`
    /* Le header fait partie du flux normal : il disparaît quand on descend */
    #app > header,
    header{
      position:relative !important;
      top:auto !important;
      z-index:5;
    }
    @media(max-width:480px){
      #app > header{
        position:relative !important;
        top:auto !important;
      }
    }
  `;
  document.head.appendChild(style);

  /*
   * iOS peut suspendre brièvement la PWA pendant la feuille Face ID.
   * Dans certains cas, navigator.credentials.get() reste en attente et bioBusy
   * ne repasse jamais à false. On ajoute donc :
   * - un timeout contrôlé ;
   * - une remise à zéro au retour pageshow/focus/visibilitychange ;
   * - une exécution du callback après retour au thread UI.
   */
  bioAssert=async function(){
    const id=localStorage.getItem('bio_cred');
    if(!id) return false;

    let timer=null;
    const timeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error('Face ID timeout')),15000);
    });

    const request=navigator.credentials.get({publicKey:{
      challenge:crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials:[{type:'public-key',id:b64uDec(id),transports:['internal']}],
      userVerification:'required',
      timeout:12000
    }});

    try{
      const cred=await Promise.race([request,timeout]);
      return !!cred;
    }finally{
      if(timer) clearTimeout(timer);
    }
  };

  tryBioUnlock=async function(){
    if(bioBusy||lock.mode!=='verify'||!bioEnabled()||!$('#lock').classList.contains('open')) return;
    bioBusy=true;
    try{
      const ok=await bioAssert();
      if(!ok) return;
      const cb=lock.onDone;
      hideLock();
      lock.busy=false;
      // Laisse Safari/PWA reprendre complètement le focus avant la suite du boot.
      setTimeout(()=>{
        try{
          const r=cb&&cb();
          if(r&&typeof r.catch==='function') r.catch(()=>{});
        }catch(_){ }
      },120);
    }catch(_){
      // Échec/annulation/timeout : on garde le PIN immédiatement disponible.
      const sub=$('#lock-sub');
      if(sub) sub.textContent='Face ID ou code à 6 chiffres';
    }finally{
      bioBusy=false;
    }
  };

  let lastResume=0;
  function recoverAfterIOSAuth(){
    const now=Date.now();
    if(now-lastResume<250) return;
    lastResume=now;

    // Important : ne jamais rester bloqué après fermeture de la feuille Face ID.
    bioBusy=false;
    lock.busy=false;

    const lockOpen=$('#lock')&&$('#lock').classList.contains('open');
    if(lockOpen){
      syncLockBio(false);
      return;
    }

    // Si Face ID a réussi mais que le retour Google n'a pas repris,
    // réinitialise le client OAuth et tente une reprise silencieuse.
    const connect=$('#screen-connect');
    if(connect&&connect.style.display!=='none'&&CFG.clientId&&CFG.sheetId){
      setTimeout(()=>{
        try{
          if(window.google&&google.accounts&&google.accounts.oauth2){
            initAuth();
            requestToken({interactive:false}).then(()=>onAuthed()).catch(()=>{});
          }
        }catch(_){ }
      },180);
    }
  }

  window.addEventListener('pageshow',recoverAfterIOSAuth);
  window.addEventListener('focus',recoverAfterIOSAuth);
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden) recoverAfterIOSAuth();
  });
})();
