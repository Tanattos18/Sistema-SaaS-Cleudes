// Service worker da vitrine: abre rápido e aguenta internet fraca.
// Fotos e arquivos do site: do cache primeiro. Páginas da loja: da rede, com cópia de reserva.
// Painel, login e envios (POST) nunca passam pelo cache.
const VERSAO = "v1";
const ESTATICOS = `estaticos-${VERSAO}`;
const PAGINAS = `paginas-${VERSAO}`;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGINAS).then((c) => c.add("/offline.html")).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => ![ESTATICOS, PAGINAS].includes(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (/^\/(painel|login|trocar-senha|api)(\/|$)/.test(url.pathname)) return;

  if (/^\/(produtos|icones|_next\/static)\//.test(url.pathname)) {
    e.respondWith(
      caches.open(ESTATICOS).then(async (c) => {
        const salvo = await c.match(req);
        if (salvo) return salvo;
        const resp = await fetch(req);
        if (resp.ok) c.put(req, resp.clone());
        return resp;
      }),
    );
    return;
  }

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp.ok) caches.open(PAGINAS).then((c) => c.put(req, resp.clone()));
          return resp;
        })
        .catch(async () => (await caches.match(req)) ?? (await caches.match("/offline.html"))),
    );
  }
});
