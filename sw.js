/* Service worker v7.5.1 : réseau d'abord, cache hors-ligne.
   Les patches v7.5 et v7.5.1 sont ajoutés à app.js à la volée. */
const CACHE = 'budget-saisie-v7-5-1';
const SHELL = ['./', './index.html', './app.js', './patch-v75.js', './patch-v751.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png'];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

async function networkOrCache(req){
  try{
    const resp=await fetch(req);
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
  try{ base=await fetch(req); }
  catch(_){ base=await caches.match(req); }
  if(!base) throw new Error('app.js indisponible');

  const [p75,p751]=await Promise.all([getPatch('./patch-v75.js'),getPatch('./patch-v751.js')]);
  const baseText=await base.text();
  const p75Text=p75?await p75.text():'';
  const p751Text=p751?await p751.text():'';
  const body=baseText+
    '\n\n/* === Budget v7.5 runtime patch === */\n'+p75Text+
    '\n\n/* === Budget v7.5.1 classic month fix === */\n'+p751Text;

  const out=new Response(body,{status:200,headers:{
    'Content-Type':'application/javascript; charset=utf-8',
    'Cache-Control':'no-store'
  }});
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
