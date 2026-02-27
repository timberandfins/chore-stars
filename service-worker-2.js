const CACHE = 'chore-cuties-v1';
const ASSETS = ['./', './index.html', './style.css', './app.js',
  'https://fonts.googleapis.com/css2?family=Pacifico&family=Quicksand:wght@400;500;600;700&display=swap'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => { e.respondWith(caches.match(e.request).then(cached=>{ if(cached)return cached; return fetch(e.request).then(r=>{ if(e.request.method==='GET'&&r.status===200){const cl=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cl));} return r; }).catch(()=>cached); })); });
