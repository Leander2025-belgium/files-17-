// OVFlow service worker – app-shell offline, API altijd live
const VERSION = 'ovflow-v1';
const SHELL = ['./', './index.html', './ovflow.css', './js/app.js', './js/api.js', './js/util.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png'];
const CDN = ['https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL).then(() => Promise.allSettled(CDN.map(u => c.add(u))))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ovflow-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Live data nooit cachen
  if (/transitous\.org|irail\.be|\/ov-proxy/.test(url.href)) return;
  // App-shell: netwerk eerst (altijd de nieuwste versie), cache als fallback
  if (url.origin === location.origin || CDN.includes(url.href)) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
  }
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => {
    const c = list.find(x => x.url.includes('/ovflow/'));
    return c ? c.focus() : self.clients.openWindow('./#/follow');
  }));
});
