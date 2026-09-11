/* Service worker : installation PWA + démarrage hors-ligne.
   Stratégie "réseau d'abord" pour l'app (index.html, app.js…) : on sert
   toujours la dernière version en ligne, et le cache ne sert que de secours
   hors-ligne. Les appels Google (auth/API) ne sont jamais interceptés. */
const CACHE = 'budget-saisie-v7-2';
const SHELL = ['./', './index.html', './app.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png'];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});
self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);
  // Laisser passer Google (auth / API) directement au réseau
  if(url.hostname.includes('googleapis.com') || url.hostname.includes('google.com') || url.hostname.includes('gstatic.com')) return;
  if(e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Réseau d'abord, cache en secours (hors-ligne)
  e.respondWith(
    fetch(e.request).then(resp=>{
      const copy = resp.clone();
      caches.open(CACHE).then(c=>c.put(e.request, copy)).catch(()=>{});
      return resp;
    }).catch(()=> caches.match(e.request))
  );
});
