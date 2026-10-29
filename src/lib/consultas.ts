import { and, asc, count, desc, eq, gte, inArray, ne, sum } from "drizzle-orm";
import { schema, type DB } from "@/db";
import type { StatusPedido } from "@/db/schema";
import { hojeISO } from "./formato";
import type { PedidoMensagem } from "./whatsapp";

export type PedidoCompleto = typeof schema.pedidos.$inferSelect & { itens: (typeof schema.pedidoItens.$inferSelect)[] };

export async function pedidoComItens(db: DB, filtro: { codigo: string } | { id: number }): Promise<PedidoCompleto | undefined> {
  const [pedido] = await db
    .select()
    .from(schema.pedidos)
    .where("codigo" in filtro ? eq(schema.pedidos.codigo, filtro.codigo) : eq(schema.pedidos.id, filtro.id));
  if (!pedido) return undefined;
  const itens = await db.select().from(schema.pedidoItens).where(eq(schema.pedidoItens.pedidoId, pedido.id)).orderBy(asc(schema.pedidoItens.id));
  return { ...pedido, itens };
}

export function paraMensagem(p: PedidoCompleto): PedidoMensagem {
  return { ...p, pago: p.pagoEm != null };
}

const EM_ANDAMENTO: StatusPedido[] = ["aguardando_pagamento", "novo", "em_separacao", "saiu_entrega"];

/** Sem filtro: todos os pedidos em andamento. Com filtro (entregue/cancelado): só os últimos 7 dias. */
export async function pedidosDoPainel(db: DB, lojaId: number, filtro: StatusPedido | null, agora = new Date()) {
  const P = schema.pedidos;
  const condicao = filtro
    ? and(eq(P.status, filtro), gte(P.criadoEm, new Date(agora.getTime() - 7 * 24 * 3600_000)))
    : inArray(P.status, EM_ANDAMENTO);
  return db.select().from(P).where(and(eq(P.lojaId, lojaId), condicao)).orderBy(desc(P.criadoEm)).limit(200);
}

/** Números do dia para o topo do painel. "Hoje" é o dia em Brasília (sem horário de verão desde 2019). */
export async function resumoDoDia(db: DB, lojaId: number, agora = new Date()) {
  const P = schema.pedidos;
  const inicio = new Date(`${hojeISO(agora)}T00:00:00-03:00`);
  const [[dia], [andamento], [falta]] = await Promise.all([
    db
      .select({ pedidos: count(), total: sum(P.total).mapWith(Number) })
      .from(P)
      .where(and(eq(P.lojaId, lojaId), gte(P.criadoEm, inicio), ne(P.status, "cancelado"), ne(P.status, "aguardando_pagamento"))),
    db.select({ n: count() }).from(P).where(and(eq(P.lojaId, lojaId), inArray(P.status, ["novo", "em_separacao", "saiu_entrega"]))),
    db
      .select({ n: count() })
      .from(schema.produtos)
      .where(and(eq(schema.produtos.lojaId, lojaId), eq(schema.produtos.ativo, true), eq(schema.produtos.disponivel, false))),
  ]);
  return { pedidosHoje: dia.pedidos, faturamentoHoje: dia.total ?? 0, emAndamento: andamento.n, emFalta: falta.n };
}
