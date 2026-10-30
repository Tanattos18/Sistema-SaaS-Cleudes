import { and, eq } from "drizzle-orm";
import { schema, type DB } from "@/db";
import type { FormaPagamento } from "@/db/schema";
import { decifrar } from "./segredo";

/**
 * Mercado Pago, Checkout Pro: o cliente é levado à página de pagamento do Mercado Pago (Pix ou cartão)
 * e volta para o pedido. A confirmação vem pela notificação (webhook) e também é conferida na volta;
 * em ambos os casos o pagamento é consultado na API com a credencial da loja, então uma notificação
 * falsa não aprova nada.
 */

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

async function chamar<T>(token: string, caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API()}${caminho}`, {
    ...opcoes,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opcoes.headers ?? {}) },
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

export async function buscarPagamento(token: string, id: string | number): Promise<PagamentoMP> {
  return chamar<PagamentoMP>(token, `/v1/payments/${encodeURIComponent(String(id))}`);
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
 * Consulta o pagamento no Mercado Pago e, se aprovado e com o valor certo, libera o pedido:
 * vira "novo", entra na lista da loja e vai para a impressora.
 */
export async function confirmarPagamento(db: DB, loja: { id: number; mpAccessToken: string | null }, pagamentoId: string | number, agora = new Date()) {
  const token = tokenDaLoja(loja);
  if (!token) return { decisao: "ignorar" as Decisao };
  const pg = await buscarPagamento(token, pagamentoId);
  if (!pg.external_reference) return { decisao: "outro_pedido" as Decisao, pagamento: pg };
  const [pedido] = await db
    .select({ id: schema.pedidos.id, codigo: schema.pedidos.codigo, total: schema.pedidos.total, status: schema.pedidos.status, pagoEm: schema.pedidos.pagoEm })
    .from(schema.pedidos)
    .where(and(eq(schema.pedidos.codigo, pg.external_reference), eq(schema.pedidos.lojaId, loja.id)));
  if (!pedido) return { decisao: "outro_pedido" as Decisao, pagamento: pg };
  const decisao = decidir(pedido, pg);
  if (decisao === "aprovar") {
    await db
      .update(schema.pedidos)
      .set({ status: "novo", pagoEm: agora, mpPagamentoId: String(pg.id) })
      .where(and(eq(schema.pedidos.id, pedido.id), eq(schema.pedidos.status, "aguardando_pagamento")));
  } else if (decisao === "ignorar" && !pedido.pagoEm) {
    // Guarda o último pagamento tentado (recusado/pendente), útil para o atendimento.
    await db.update(schema.pedidos).set({ mpPagamentoId: String(pg.id) }).where(eq(schema.pedidos.id, pedido.id));
  }
  return { decisao, pagamento: pg, pedidoId: pedido.id };
}
