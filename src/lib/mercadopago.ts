import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { schema, type DB } from "@/db";
import type { FormaPagamento } from "@/db/schema";
import { avisarLoja } from "./avisos";
import { decifrar } from "./segredo";

/**
 * Mercado Pago, no mesmo formato já validado na Akylla Shop:
 * - Pix: gerado aqui mesmo pela API de Orders; o cliente vê o QR code e o copia e cola na página do pedido.
 * - Cartão: Checkout Pro; o cliente digita o cartão na página do Mercado Pago e volta para o pedido.
 * A confirmação vem pela notificação (webhook, com assinatura secreta), pela página do pedido aberta e
 * pelo programa da impressora; em todos os casos o pagamento é consultado na API com a credencial da loja,
 * então uma notificação falsa não aprova nada.
 */

type Loja = typeof schema.lojas.$inferSelect;

const API = () => (process.env.MERCADOPAGO_API ?? "https://api.mercadopago.com").replace(/\/$/, "");

/** Tempo para pagar; depois disso o link do Mercado Pago expira e o cliente gera outro na página do pedido. */
export const MINUTOS_PARA_PAGAR = 30;

export type PagamentoMP = {
  id: number | string;
  status: "approved" | "pending" | "in_process" | "authorized" | "rejected" | "cancelled" | "refunded" | "charged_back" | string;
  external_reference: string | null;
  transaction_amount: number;
  payment_method_id?: string;
  payment_type_id?: string;
};

async function chamar<T>(token: string, caminho: string, opcoes: RequestInit & { idempotencia?: string } = {}): Promise<T> {
  const { idempotencia, ...resto } = opcoes;
  const r = await fetch(`${API()}${caminho}`, {
    ...resto,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(idempotencia ? { "X-Idempotency-Key": idempotencia } : {}),
      ...(resto.headers ?? {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) {
    const corpo = await r.text().catch(() => "");
    throw new Error(`Mercado Pago respondeu ${r.status}${corpo ? `: ${corpo.slice(0, 200)}` : ""}`);
  }
  return r.json() as Promise<T>;
}

export function tokenDaLoja(loja: { mpAccessToken: string | null }): string | null {
  return decifrar(loja.mpAccessToken);
}

/** Confere a credencial e devolve o nome da conta, para o lojista saber que conectou a conta certa. */
export async function contaDoToken(token: string): Promise<{ id: number; nome: string; teste: boolean }> {
  const u = await chamar<{ id: number; nickname?: string; email?: string; first_name?: string; last_name?: string }>(token, "/users/me");
  const nome = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.nickname || u.email || String(u.id);
  return { id: u.id, nome, teste: token.startsWith("TEST-") || /^TESTUSER/i.test(u.nickname ?? "") };
}

type PedidoPagamento = { numero: number; codigo: string; total: number };

/**
 * Preferência do Checkout Pro só com o meio escolhido: Pix (transferência) ou cartão (crédito e débito).
 * O valor vai num item só, já com a entrega, para bater exatamente com o total do pedido.
 */
export function corpoPreferencia(pedido: PedidoPagamento, loja: { nome: string; slug: string }, forma: FormaPagamento, site: string, agora = new Date()) {
  const voltar = `${site}/${loja.slug}/pedido/${pedido.codigo}`;
  const excluidos = forma === "online_pix"
    ? ["credit_card", "debit_card", "prepaid_card", "ticket", "atm", "account_money"]
    : ["bank_transfer", "ticket", "atm", "account_money"];
  return {
    items: [{ id: pedido.codigo, title: `Pedido nº ${pedido.numero} - ${loja.nome}`.slice(0, 250), quantity: 1, unit_price: pedido.total, currency_id: "BRL" }],
    external_reference: pedido.codigo,
    notification_url: `${site}/api/pagamentos/mercadopago/${loja.slug}`,
    back_urls: { success: voltar, pending: voltar, failure: voltar },
    auto_return: "approved",
    payment_methods: {
      excluded_payment_types: excluidos.map((id) => ({ id })),
      installments: 1,
      ...(forma === "online_pix" ? { default_payment_method_id: "pix" } : {}),
    },
    statement_descriptor: loja.nome.replace(/[^\w ]/g, "").slice(0, 13),
    expires: true,
    expiration_date_from: agora.toISOString(),
    expiration_date_to: new Date(agora.getTime() + MINUTOS_PARA_PAGAR * 60_000).toISOString(),
  };
}

export async function criarPreferencia(token: string, ...args: Parameters<typeof corpoPreferencia>): Promise<{ id: string; link: string }> {
  const p = await chamar<{ id: string; init_point: string; sandbox_init_point?: string }>(token, "/checkout/preferences", {
    method: "POST",
    body: JSON.stringify(corpoPreferencia(...args)),
  });
  return { id: p.id, link: p.init_point };
}

/* ---------------------------- Pix (API de Orders) ---------------------------- */

export type OrdemMP = {
  id: string;
  status: string; // created | processing | action_required | processed | canceled | expired | failed | refunded
  status_detail?: string;
  total_amount: string;
  external_reference: string | null;
  transactions?: { payments?: { id?: string; payment_method?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } }[] };
};

/** A API de Orders exige um e-mail do pagador; o checkout não pede, então vai um endereço do próprio pedido. */
export function emailDoPedido(codigo: string, site: string): string {
  let host = "pedidos.local";
  try {
    host = new URL(site).hostname || host;
  } catch {}
  return `pedido+${codigo.toLowerCase().replace(/[^a-z0-9]/g, "")}@${host}`;
}

export function corpoPix(pedido: PedidoPagamento, loja: { nome: string }, email: string) {
  const valor = pedido.total.toFixed(2);
  return {
    type: "online",
    processing_mode: "automatic",
    total_amount: valor,
    external_reference: pedido.codigo,
    description: `Pedido nº ${pedido.numero} - ${loja.nome}`.slice(0, 150),
    transactions: { payments: [{ amount: valor, payment_method: { id: "pix", type: "bank_transfer" }, expiration_time: `PT${MINUTOS_PARA_PAGAR}M` }] },
    payer: { email },
  };
}

export async function criarPix(token: string, pedido: PedidoPagamento, loja: { nome: string }, site: string, agora = new Date()) {
  const o = await chamar<OrdemMP>(token, "/v1/orders", {
    method: "POST",
    // Cada tentativa é um Pix novo (o anterior pode ter expirado).
    idempotencia: `${pedido.codigo}-${agora.getTime()}`,
    body: JSON.stringify(corpoPix(pedido, loja, emailDoPedido(pedido.codigo, site))),
  });
  const pm = o.transactions?.payments?.[0]?.payment_method ?? {};
  if (!pm.qr_code) throw new Error("Mercado Pago não devolveu o código Pix.");
  return { ordemId: String(o.id), copiaECola: pm.qr_code, qrCode: pm.qr_code_base64 ?? null, expiraEm: new Date(agora.getTime() + MINUTOS_PARA_PAGAR * 60_000) };
}

export async function buscarOrdem(token: string, id: string): Promise<OrdemMP> {
  return chamar<OrdemMP>(token, `/v1/orders/${encodeURIComponent(id)}`);
}

/** Traduz a ordem do Pix para o mesmo formato de pagamento usado na decisão (aprovado, pendente, recusado). */
export function ordemComoPagamento(o: OrdemMP): PagamentoMP {
  const pago = o.status === "processed" && (!o.status_detail || o.status_detail === "accredited");
  const aberto = ["created", "processing", "action_required"].includes(o.status);
  return {
    id: o.transactions?.payments?.[0]?.id ?? o.id,
    status: pago ? "approved" : aberto ? "pending" : "cancelled",
    external_reference: o.external_reference,
    transaction_amount: Number(o.total_amount),
    payment_method_id: "pix",
  };
}

/* ------------------------------ Cartão e consultas ------------------------------ */

export async function buscarPagamento(token: string, id: string | number): Promise<PagamentoMP> {
  return chamar<PagamentoMP>(token, `/v1/payments/${encodeURIComponent(String(id))}`);
}

/** Cartão: procura pelo número do pedido (o cliente pode ter tentado mais de um cartão); prefere o aprovado. */
export async function buscarPagamentoDoPedido(token: string, codigo: string): Promise<PagamentoMP | null> {
  const r = await chamar<{ results?: PagamentoMP[] }>(
    token,
    `/v1/payments/search?external_reference=${encodeURIComponent(codigo)}&sort=date_created&criteria=desc&limit=20`,
  );
  const lista = r.results ?? [];
  return lista.find((p) => p.status === "approved") ?? lista[0] ?? null;
}

/**
 * Assinatura do webhook (cabeçalho x-signature: "ts=...,v1=..."), como a Akylla Shop confere.
 * Sem segredo cadastrado, vale a consulta ao Mercado Pago, que já impede aprovação falsa.
 */
export function assinaturaValida(segredo: string | null, xSignature: string | null, xRequestId: string | null, dataId: string): boolean {
  if (!segredo) return true;
  const partes = Object.fromEntries((xSignature ?? "").split(",").map((kv) => kv.trim().split("=", 2)));
  if (!partes.ts || !partes.v1) return false;
  const manifesto = `id:${dataId.toLowerCase()};request-id:${xRequestId ?? ""};ts:${partes.ts};`;
  const esperado = Buffer.from(createHmac("sha256", segredo).update(manifesto).digest("hex"));
  const recebido = Buffer.from(String(partes.v1));
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

export type Decisao = "aprovar" | "ignorar" | "valor_diferente" | "outro_pedido";

/** O que fazer com um pagamento em relação ao pedido. Função pura: testada à parte. */
export function decidir(pedido: { codigo: string; total: number; status: string; pagoEm: Date | null }, pg: PagamentoMP): Decisao {
  if (pg.external_reference !== pedido.codigo) return "outro_pedido";
  if (pg.status !== "approved") return "ignorar";
  if (pedido.pagoEm || pedido.status !== "aguardando_pagamento") return "ignorar"; // já confirmado (notificação repetida)
  if (Math.abs(pg.transaction_amount - pedido.total) > 0.009) return "valor_diferente";
  return "aprovar";
}

/**
 * Aplica um pagamento consultado no Mercado Pago ao pedido. Aprovado e com o valor certo, libera o
 * pedido: vira "novo", entra na lista da loja, vai para a impressora e avisa o WhatsApp da loja.
 */
async function aplicarPagamento(db: DB, loja: Loja, pg: PagamentoMP, agora: Date) {
  if (!pg.external_reference) return { decisao: "outro_pedido" as Decisao, pagamento: pg };
  const [pedido] = await db
    .select({ id: schema.pedidos.id, codigo: schema.pedidos.codigo, total: schema.pedidos.total, status: schema.pedidos.status, pagoEm: schema.pedidos.pagoEm })
    .from(schema.pedidos)
    .where(and(eq(schema.pedidos.codigo, pg.external_reference), eq(schema.pedidos.lojaId, loja.id)));
  if (!pedido) return { decisao: "outro_pedido" as Decisao, pagamento: pg };
  const decisao = decidir(pedido, pg);
  if (decisao === "aprovar") {
    const liberados = await db
      .update(schema.pedidos)
      .set({ status: "novo", pagoEm: agora, mpPagamentoId: String(pg.id) })
      .where(and(eq(schema.pedidos.id, pedido.id), eq(schema.pedidos.status, "aguardando_pagamento")))
      .returning({ id: schema.pedidos.id });
    if (liberados.length) await avisarLoja(db, loja, pedido.id);
  } else if (decisao === "ignorar" && !pedido.pagoEm) {
    // Guarda o último pagamento tentado (recusado/pendente), útil para o atendimento.
    await db.update(schema.pedidos).set({ mpPagamentoId: String(pg.id) }).where(eq(schema.pedidos.id, pedido.id));
  }
  return { decisao, pagamento: pg, pedidoId: pedido.id };
}

/** Pagamento (cartão pelo Checkout Pro) pelo número que o Mercado Pago informou. */
export async function confirmarPagamento(db: DB, loja: Loja, pagamentoId: string | number, agora = new Date()) {
  const token = tokenDaLoja(loja);
  if (!token) return { decisao: "ignorar" as Decisao };
  return aplicarPagamento(db, loja, await buscarPagamento(token, pagamentoId), agora);
}

/** Pix: consulta a ordem no Mercado Pago. */
export async function confirmarOrdem(db: DB, loja: Loja, ordemId: string, agora = new Date()) {
  const token = tokenDaLoja(loja);
  if (!token) return { decisao: "ignorar" as Decisao };
  return aplicarPagamento(db, loja, ordemComoPagamento(await buscarOrdem(token, ordemId)), agora);
}

/** Confere no Mercado Pago um pedido que aguarda pagamento, sem depender do webhook. */
export async function sincronizarPedido(db: DB, loja: Loja, pedido: { codigo: string; formaPagamento: FormaPagamento; mpOrdemId: string | null }, agora = new Date()) {
  const token = tokenDaLoja(loja);
  if (!token) return null;
  if (pedido.formaPagamento === "online_pix") return pedido.mpOrdemId ? confirmarOrdem(db, loja, pedido.mpOrdemId, agora) : null;
  const pg = await buscarPagamentoDoPedido(token, pedido.codigo);
  return pg ? aplicarPagamento(db, loja, pg, agora) : null;
}

declare global {
  var __mpSincronizado: Map<number, number> | undefined;
}

/**
 * Rede de segurança chamada pelo programa da impressora (que fica ligado o dia todo): se um aviso do
 * Mercado Pago se perder, o pedido pago é liberado assim mesmo. No máximo uma vez a cada 15 s por loja.
 */
export async function sincronizarPendentes(db: DB, loja: Loja, agora = new Date()) {
  const ultima = (globalThis.__mpSincronizado ??= new Map<number, number>());
  if (!loja.mpAccessToken || agora.getTime() - (ultima.get(loja.id) ?? 0) < 15_000) return;
  ultima.set(loja.id, agora.getTime());
  const pendentes = await db
    .select({ codigo: schema.pedidos.codigo, formaPagamento: schema.pedidos.formaPagamento, mpOrdemId: schema.pedidos.mpOrdemId })
    .from(schema.pedidos)
    .where(and(eq(schema.pedidos.lojaId, loja.id), eq(schema.pedidos.status, "aguardando_pagamento"), gt(schema.pedidos.criadoEm, new Date(agora.getTime() - 3 * 3600_000))))
    .orderBy(desc(schema.pedidos.criadoEm))
    .limit(10);
  for (const p of pendentes) {
    await sincronizarPedido(db, loja, p, agora).catch((e) => console.error("Sincronizando pagamento:", (e as Error).message));
  }
}
