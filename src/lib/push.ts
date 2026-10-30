import { eq } from "drizzle-orm";
import { schema, type DB } from "@/db";

/**
 * Notificação push (Web Push) do painel: avisa de pedido novo no celular e no computador, mesmo com
 * o painel fechado. Mesmo código já validado na Akylla Shop, sem dependências (WebCrypto do Node 18+).
 * - Chaves VAPID: geradas pelo próprio sistema na primeira vez e guardadas no banco.
 * - Criptografia da mensagem: RFC 8291 (aes128gcm); assinatura: RFC 8292 (VAPID, ES256).
 */

const enc = new TextEncoder();

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  return Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString("base64url");
}

export function deB64url(texto: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(texto, "base64url"));
}

function juntar(...partes: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const saida = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of partes) {
    saida.set(p, pos);
    pos += p.length;
  }
  return saida;
}

async function hmac(chave: Uint8Array<ArrayBuffer>, dados: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const k = await crypto.subtle.importKey("raw", chave, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, dados));
}

export type ChavesVapid = { publicKey: string; privateJwk: JsonWebKey };
export type InscricaoPush = { endpoint: string; keys: { p256dh: string; auth: string } };
export type MensagemPush = { title: string; body: string; tag?: string; url?: string };

/** Chaves VAPID do sistema (criadas uma vez e guardadas no banco). */
export async function chavesVapid(db: DB): Promise<ChavesVapid> {
  const [salva] = await db.select({ valor: schema.chavesSistema.valor }).from(schema.chavesSistema).where(eq(schema.chavesSistema.chave, "push-vapid"));
  if (salva) return JSON.parse(salva.valor) as ChavesVapid;
  const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const chaves: ChavesVapid = {
    publicKey: b64url(await crypto.subtle.exportKey("raw", par.publicKey)),
    privateJwk: await crypto.subtle.exportKey("jwk", par.privateKey),
  };
  // Duas requisições ao mesmo tempo: vale a primeira gravada.
  await db.insert(schema.chavesSistema).values({ chave: "push-vapid", valor: JSON.stringify(chaves) }).onConflictDoNothing();
  const [final] = await db.select({ valor: schema.chavesSistema.valor }).from(schema.chavesSistema).where(eq(schema.chavesSistema.chave, "push-vapid"));
  return JSON.parse(final.valor) as ChavesVapid;
}

async function cabecalhoVapid(endpoint: string, chaves: ChavesVapid, assunto: string): Promise<string> {
  const aud = new URL(endpoint).origin;
  const cab = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const dados = b64url(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: assunto })));
  const k = await crypto.subtle.importKey("jwk", chaves.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const assinatura = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k, enc.encode(`${cab}.${dados}`));
  return `vapid t=${cab}.${dados}.${b64url(assinatura)}, k=${chaves.publicKey}`;
}

/** Criptografa a mensagem para a inscrição do navegador (RFC 8291). */
export async function criptografar(inscricao: InscricaoPush, texto: string): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublica = deB64url(inscricao.keys.p256dh);
  const segredoAuth = deB64url(inscricao.keys.auth);
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublica = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaChave = await crypto.subtle.importKey("raw", uaPublica, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const compartilhado = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaChave }, local.privateKey, 256));

  const prkChave = await hmac(segredoAuth, compartilhado);
  const ikm = await hmac(prkChave, juntar(enc.encode("WebPush: info\0"), uaPublica, asPublica, new Uint8Array([1])));
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(sal, ikm);
  const cek = (await hmac(prk, juntar(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, juntar(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, juntar(enc.encode(texto), new Uint8Array([2]))));
  const cabeca = new Uint8Array(21);
  cabeca.set(sal, 0);
  new DataView(cabeca.buffer).setUint32(16, 4096);
  cabeca[20] = asPublica.length;
  return juntar(cabeca, asPublica, cifrado);
}

/** Envia uma notificação. Devolve o status HTTP (201 = entregue; 404/410 = inscrição não existe mais). */
export async function enviarPush(inscricao: InscricaoPush, mensagem: MensagemPush, chaves: ChavesVapid, assunto: string): Promise<number> {
  const corpo = await criptografar(inscricao, JSON.stringify(mensagem));
  const r = await fetch(inscricao.endpoint, {
    method: "POST",
    headers: {
      Authorization: await cabecalhoVapid(inscricao.endpoint, chaves, assunto),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body: corpo,
    signal: AbortSignal.timeout(15000),
  });
  return r.status;
}

/** Manda para todos os aparelhos da loja; apaga os que não existem mais. Devolve quantos receberam. */
export async function notificarLoja(db: DB, lojaId: number, mensagem: MensagemPush, assunto: string): Promise<number> {
  const inscricoes = await db.select().from(schema.inscricoesPush).where(eq(schema.inscricoesPush.lojaId, lojaId));
  if (!inscricoes.length) return 0;
  const chaves = await chavesVapid(db);
  let entregues = 0;
  await Promise.all(
    inscricoes.map(async (i) => {
      try {
        const status = await enviarPush({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, mensagem, chaves, assunto);
        if (status === 404 || status === 410) await db.delete(schema.inscricoesPush).where(eq(schema.inscricoesPush.id, i.id));
        else if (status < 300) entregues++;
        else console.error("Push recusado:", status, new URL(i.endpoint).host);
      } catch (e) {
        console.error("Push falhou:", (e as Error).message);
      }
    }),
  );
  return entregues;
}
