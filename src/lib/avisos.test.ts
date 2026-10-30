import { describe, expect, it } from "vitest";
import { mensagemPush } from "./avisos";
import { b64url, criptografar } from "./push";
import { corpoModelo, limparParametro } from "./whatsapp-meta";

const enc = new TextEncoder();

async function hmac(chave: Uint8Array<ArrayBuffer>, dados: Uint8Array<ArrayBuffer>) {
  const k = await crypto.subtle.importKey("raw", chave, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, dados));
}
const juntar = (...p: Uint8Array[]) => {
  const s = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let i = 0;
  for (const x of p) (s.set(x, i), (i += x.length));
  return s;
};

/** Faz o papel do navegador: descriptografa a mensagem (RFC 8291) com a chave do aparelho. */
async function descriptografar(corpo: Uint8Array, aparelho: CryptoKeyPair, auth: Uint8Array<ArrayBuffer>) {
  const sal = corpo.slice(0, 16);
  const tamanho = corpo[20];
  const asPublica = corpo.slice(21, 21 + tamanho);
  const cifrado = corpo.slice(21 + tamanho);
  const uaPublica = new Uint8Array(await crypto.subtle.exportKey("raw", aparelho.publicKey));
  const asChave = await crypto.subtle.importKey("raw", asPublica, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const compartilhado = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asChave }, aparelho.privateKey, 256));
  const ikm = await hmac(await hmac(auth, compartilhado), juntar(enc.encode("WebPush: info\0"), uaPublica, asPublica, new Uint8Array([1])));
  const prk = await hmac(sal, ikm);
  const cek = (await hmac(prk, juntar(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, juntar(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const claro = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, cifrado));
  return new TextDecoder().decode(claro.slice(0, -1));
}

describe("notificação no painel (Web Push)", () => {
  it("a mensagem criptografada só abre com a chave do aparelho e chega igual", async () => {
    const aparelho = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const inscricao = { endpoint: "https://push.exemplo/x", keys: { p256dh: b64url(await crypto.subtle.exportKey("raw", aparelho.publicKey)), auth: b64url(auth) } };
    const texto = JSON.stringify({ title: "🛒 Novo pedido nº 12 · R$ 85,40", body: "Maria · Centro · Pix (pago)" });
    const corpo = await criptografar(inscricao, texto);
    expect(await descriptografar(corpo, aparelho, auth)).toBe(texto);
  });

  it("monta o título e o link do pedido; o teste tem texto próprio", () => {
    const d = { numero: 12, loja: "Supermercado Caixeta", total: "R$ 85,40", pagamento: "Pix (pago)", cliente: "Maria", bairro: "Centro", link: "x" };
    expect(mensagemPush(d, 40)).toEqual({ title: "🛒 Novo pedido nº 12 · R$ 85,40", body: "Maria · Centro · Pix (pago)", tag: "pedido-12", url: "/painel/pedidos/40" });
    expect(mensagemPush(d, 0).title).toBe("🔔 Aviso de teste");
  });
});

describe("WhatsApp oficial (Meta)", () => {
  it("manda o modelo com as 7 variáveis na ordem combinada", () => {
    const c = corpoModelo("556281517002", { numero: 7, loja: "Caixeta", total: "R$ 10,00", pagamento: "Dinheiro", cliente: "Ana", bairro: "Centro", link: "https://x/p/7" });
    expect(c).toMatchObject({ messaging_product: "whatsapp", to: "556281517002", type: "template", template: { name: "novo_pedido", language: { code: "pt_BR" } } });
    expect(c.template.components[0].parameters.map((p) => p.text)).toEqual(["7", "Caixeta", "R$ 10,00", "Dinheiro", "Ana", "Centro", "https://x/p/7"]);
  });

  it("limpa o que a Meta recusa dentro de uma variável", () => {
    expect(limparParametro("Rua A\nCasa\t2      fundos")).toBe("Rua A Casa 2   fundos");
    expect(limparParametro("   ")).toBe("-");
  });
});
