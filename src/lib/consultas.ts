import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { schema, type DB } from "@/db";
import type { StatusPedido } from "@/db/schema";
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
