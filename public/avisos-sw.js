// Service worker do painel (escopo /painel/): recebe os avisos de pedido e mostra a notificação no
// celular ou computador, mesmo com o painel fechado. Não guarda nada em cache.
"use strict";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let msg = {};
  try {
    msg = e.data ? e.data.json() : {};
  } catch {
    msg = { body: e.data && e.data.text() };
  }
  e.waitUntil(
    Promise.all([
      self.registration.showNotification(msg.title || "Novo pedido", {
        body: msg.body || "Abra o painel para ver o pedido.",
        tag: msg.tag || "pedido",
        renotify: true,
        requireInteraction: true,
        icon: "/icones/icone-192.png",
        badge: "/icones/icone-192.png",
        vibrate: [300, 120, 300, 120, 500],
        data: { url: msg.url || "/painel" },
      }),
      // Painel aberto: avisa a página para tocar o som e atualizar a lista.
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => lista.forEach((c) => c.postMessage({ tipo: "pedido-novo" }))),
    ]),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/painel", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      const painel = lista.find((c) => new URL(c.url).pathname.startsWith("/painel"));
      if (painel) return painel.navigate(url).then((c) => (c || painel).focus());
      return self.clients.openWindow(url);
    }),
  );
});
