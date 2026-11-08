/* Budget PWA v7.5.30
   - Acces Google Sheets perenne via backend Vercel + compte de service
   - Le navigateur conserve un jeton appareil longue duree, jamais la cle Google
   - Une seule verification OAuth Google sert a appairer l'appareil
   - Retour automatique a l'ancien OAuth si le backend n'est pas encore configure
*/
'use strict';

(function installV7530(){
  if(window.__budgetV7530) return;
  window.__budgetV7530=true;

  const DEVICE_KEY='budget_device_token_v1';
  const directApi=api;
  const directRestoreTok=restoreTok;
  let backendUnavailableUntil=0;

  function deviceToken(){ return localStorage.getItem(DEVICE_KEY)||''; }
  function saveDeviceToken(t){ if(t) localStorage.setItem(DEVICE_KEY,t); }
  function clearDeviceToken(){ localStorage.removeItem(DEVICE_KEY); }

  function paramPairs(params){
    if(!params) return [];
    if(params instanceof URLSearchParams) return Array.from(params.entries());
    return Object.entries(params).filter(([,v])=>v!==undefined&&v!==null).map(([k,v])=>[k,String(v)]);
  }

  async function bootstrapDevice(){
    const existing=deviceToken();
    if(existing) return existing;
    await ensureToken();
    const r=await fetch('/api/bootstrap',{
      method:'POST',
      headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},
      body:'{}',
      cache:'no-store'
    });
    if(!r.ok){
      const text=await r.text().catch(()=>'');
      throw new Error('Bootstrap backend '+r.status+(text?': '+text.slice(0,120):''));
    }
    const j=await r.json();
    if(!j.token) throw new Error('Jeton appareil absent.');
    saveDeviceToken(j.token);
    return j.token;
  }

  /* Les appels Google Sheets passent tous par ce proxy. Réduire les
     lectures concurrentes et gérer les quotas avant de toucher aux écritures. */
  const pendingReads=new Map();
  let nextReadSlot=0;
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function backendApi(path,{method='GET',params=null,body=null}={}){
    const pairs=paramPairs(params);
    const key=method==='GET'?JSON.stringify([path,pairs]):null;
    if(key&&pendingReads.has(key)) return pendingReads.get(key);
    const job=(async()=>{
      let token=deviceToken();
      if(!token) token=await bootstrapDevice();
      const send=()=>fetch('/api/sheets',{
        method:'POST',
        headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({path,method,params:pairs,body}),
        cache:'no-store'
      });
      const attempts=method==='GET'?5:1;
      for(let attempt=0;attempt<attempts;attempt++){
        if(method==='GET'){
          const slot=Math.max(Date.now(),nextReadSlot);
          nextReadSlot=slot+2200;
          if(slot>Date.now()) await delay(slot-Date.now());
        }
        let r=await send();
        if(r.status===401){
          clearDeviceToken();
          token=await bootstrapDevice();
          r=await send();
        }
        if(r.status===429&&method==='GET'&&attempt<attempts-1){
          const coolDown=Math.min(25000,3000*Math.pow(2,attempt));
          nextReadSlot=Math.max(nextReadSlot,Date.now()+coolDown);
          await delay(coolDown);
          continue;
        }
        if(!r.ok){
          const errorText=await r.text().catch(()=>'');
          if(r.status===429) throw new Error('Google Sheets temporairement saturé (429). Réessaie dans une minute, sans multiplier les clics.');
          throw new Error('Backend '+r.status+(errorText?': '+errorText.slice(0,160):''));
        }
        lastSync=Date.now();
        return r.json();
      }
    })();
    if(key) pendingReads.set(key,job);
    try{return await job;}finally{if(key)pendingReads.delete(key);}
  }

  api=async function(path,opts={}){
    if(Date.now()<backendUnavailableUntil) return directApi(path,opts);
    try{
      return await backendApi(path,opts);
    }catch(e){
      const msg=String(e&&e.message||e);
      if(msg.includes('Backend 503')||msg.includes('Bootstrap backend 503')||msg.includes('Failed to fetch')){
        backendUnavailableUntil=Date.now()+5*60*1000;
        return directApi(path,opts);
      }
      throw e;
    }
  };

  restoreTok=function(){
    if(deviceToken()){
      accessToken='SERVER_SESSION';
      tokenExpiry=Date.now()+3650*24*3600*1000;
      return true;
    }
    return directRestoreTok();
  };

  const oldClearTok=clearTok;
  clearTok=function(){
    oldClearTok();
    /* Le logout Google ne casse pas la session backend persistante.
       Le bouton "effacer les reglages" utilise localStorage.clear(), donc retire bien le jeton appareil. */
  };

  window.budgetBackendStatus=()=>({
    paired:!!deviceToken(),
    fallbackUntil:backendUnavailableUntil
  });
})();