// Bratislava Spots: service worker.
// Permite instalarla como app y abrirla sin conexión con lo último que se cargó.
// Archivos propios: primero la red (la página y los datos se revalidan siempre con GitHub, así ves la última versión);
// si no hay conexión, se usa lo guardado. Leaflet y las fuentes (versión fija): primero lo guardado.
const CACHE = "ba-spots-v3";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all([
    c.addAll(["./", "./manifest.webmanifest", "./icon-192.png"]),
    c.add("https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js").catch(() => {})   // el mapa, para abrir sin conexión
  ])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  const propio = u.origin === self.location.origin;
  const fijo = /^(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname);
  if (!propio && !fijo) return;

  if (fijo){
    e.respondWith(caches.match(r).then(c => c || fetch(r).then(resp => {
      const copia = resp.clone(); caches.open(CACHE).then(ca => ca.put(r, copia)); return resp;
    })));
    return;
  }

  const clave = u.origin + u.pathname;   // sin "?v=..." para no llenar la caché
  // la página y los eventos se piden "sin caché": el navegador pregunta a GitHub si cambiaron
  // (si no cambiaron, la respuesta es mínima), así una versión nueva aparece al abrir la app.
  const fresco = r.mode === "navigate" || /\/$|\.html$|\.json$|\.webmanifest$/.test(u.pathname);
  const pedido = fresco ? fetch(u.href, {cache: "no-cache", credentials: "same-origin"}) : fetch(r);
  e.respondWith(pedido.then(resp => {
    if (resp.ok){ const copia = resp.clone(); caches.open(CACHE).then(ca => ca.put(clave, copia)); }
    return resp;
  }).catch(() => caches.match(clave).then(c => c || caches.match("./"))));
});
