const C='checklist-s5-v2';
const FILES=['./','index.html','quiz.js','questions.json','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  const same=url.origin===location.origin;
  const fresh=same&&(e.request.mode==='navigate'||/\.(html|js|json)$/.test(url.pathname)||url.pathname.endsWith('/'));
  if(fresh){ // réseau d'abord (mises à jour), cache si hors ligne
    e.respondWith(fetch(e.request).then(res=>{ if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(e.request,cp));} return res; })
      .catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    if(res.ok&&(same||url.hostname.includes('fonts.g'))){const cp=res.clone();caches.open(C).then(c=>c.put(e.request,cp));}
    return res;})));
});
