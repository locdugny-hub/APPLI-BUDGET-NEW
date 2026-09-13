/* Service worker v7.5.10 : réseau d'abord, cache hors-ligne.
   Charge dashboard, réparation des mois, auth fluide, dashboard premium cash,
   synchronisation automatique des GID Google, filtres déroulants, layout final,
   optimisation iPhone 12 Pro Max et header mobile compact.
   Recharge les fenêtres ouvertes à l'activation pour éviter un ancien cache. */
const CACHE = 'budget-saisie-v7-5-10';
const SHELL = ['./', './index.html', './app.js', './patch-v75.js', './patch-v751.js', './patch-v753.js', './patch-v754.js', './patch-v755.js', './patch-v756.js', './patch-v757.js', './patch-v758.js', './patch-v759.js', './patch-v7510.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png'];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', (e)=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
    const cs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    await Promise.all(cs.map(c=>c.navigate(c.url).catch(()=>{})));
  })());
});

async function networkOrCache(req){
  try{
    const resp=await fetch(req,{cache:'no-store'});
    const copy=resp.clone();
    caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
    return resp;
  }catch(_){
    return caches.match(req);
  }
}

async function getPatch(path){
  const req=new Request(new URL(path,self.location.href),{cache:'no-store'});
  try{ return await fetch(req); }
  catch(_){ return caches.match(path); }
}

async function patchedApp(req){
  let base;
  try{ base=await fetch(req,{cache:'no-store'}); }
  catch(_){ base=await caches.match(req); }
  if(!base) throw new Error('app.js indisponible');

  const [p75,p752,p753,p754,p755,p756,p757,p758,p759,p7510]=await Promise.all([
    getPatch('./patch-v75.js'),
    getPatch('./patch-v751.js'),
    getPatch('./patch-v753.js'),
    getPatch('./patch-v754.js'),
    getPatch('./patch-v755.js'),
    getPatch('./patch-v756.js'),
    getPatch('./patch-v757.js'),
    getPatch('./patch-v758.js'),
    getPatch('./patch-v759.js'),
    getPatch('./patch-v7510.js')
  ]);
  const baseText=await base.text();
  const p75Text=p75?await p75.text():'';
  const p752Text=p752?await p752.text():'';
  const p753Text=p753?await p753.text():'';
  const p754Text=p754?await p754.text():'';
  const p755Text=p755?await p755.text():'';
  const p756Text=p756?await p756.text():'';
  const p757Text=p757?await p757.text():'';
  const p758Text=p758?await p758.text():'';
  const p759Text=p759?await p759.text():'';
  const p7510Text=p7510?await p7510.text():'';
  const body=baseText+'\n\n/* === Budget v7.5 dashboard === */\n'+p75Text+'\n\n/* === Budget v7.5.2 month repair === */\n'+p752Text+'\n\n/* === Budget v7.5.3 auth + dashboard polish === */\n'+p753Text+'\n\n/* === Budget v7.5.4 premium cash dashboard === */\n'+p754Text+'\n\n/* === Budget v7.5.5 Google Sheet month GID sync === */\n'+p755Text+'\n\n/* === Budget v7.5.6 premium dropdown filters === */\n'+p756Text+'\n\n/* === Budget v7.5.7 final dashboard layout === */\n'+p757Text+'\n\n/* === Budget v7.5.8 iPhone 12 Pro Max optimization === */\n'+p758Text+'\n\n/* === Budget v7.5.9 mobile visual tuning === */\n'+p759Text+'\n\n/* === Budget v7.5.10 compact mobile header === */\n'+p7510Text;
  const out=new Response(body,{status:200,headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store'}});
  caches.open(CACHE).then(c=>c.put(req,out.clone())).catch(()=>{});
  return out;
}

self.addEventListener('fetch', (e)=>{
  const url=new URL(e.request.url);
  if(url.hostname.includes('googleapis.com') || url.hostname.includes('google.com') || url.hostname.includes('gstatic.com')) return;
  if(e.request.method!=='GET' || url.origin!==self.location.origin) return;
  if(url.pathname.endsWith('/app.js')){
    e.respondWith(patchedApp(e.request).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(networkOrCache(e.request));
});
