// Service worker da demonstração: fotos e arquivos do cache; página e catálogo da rede, com reserva.
const CACHE = "caixeta-demo-v3";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "index.html", "estilo.css", "app.js", "catalogo.json"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((n) => Promise.all(n.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const estatico = /\/(produtos|icones)\//.test(url.pathname) || url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com");
  if (estatico) {
    e.respondWith(caches.match(req).then((salvo) => salvo || fetch(req).then((resp) => {
      if (resp.ok || resp.type === "opaque") caches.open(CACHE).then((c) => c.put(req, resp.clone()));
      return resp;
    })));
    return;
  }
  if (url.origin !== self.location.origin) return;
  e.respondWith(fetch(req).then((resp) => {
    if (resp.ok) caches.open(CACHE).then((c) => c.put(req, resp.clone()));
    return resp;
  }).catch(() => caches.match(req)));
});
