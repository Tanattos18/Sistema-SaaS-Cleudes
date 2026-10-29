import { timingSafeEqual } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import { schema, type DB } from "@/db";
import { montarComprovante, type LinhaComprovante } from "./comprovante";
import { pedidoComItens } from "./consultas";

export type PedidoParaImprimir = { id: number; numero: number; linhas: LinhaComprovante[] };

/** Loja dona da chave de impressão enviada pelo programa do balcão (cabeçalho Authorization: Bearer). */
export async function lojaDaChave(db: DB, cabecalho: string | null) {
  const chave = cabecalho?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!chave || chave.length < 20) return undefined;
  const [loja] = await db
    .select({ id: schema.lojas.id, nome: schema.lojas.nome, token: schema.lojas.tokenImpressao })
    .from(schema.lojas)
    .where(and(eq(schema.lojas.tokenImpressao, chave), eq(schema.lojas.ativo, true)));
  // Comparação em tempo constante, por precaução, depois de achar a loja.
  if (!loja || !timingSafeEqual(Buffer.from(loja.token), Buffer.from(chave))) return undefined;
  return loja;
}

/**
 * Pedidos prontos para imprimir: "novo" (pago no site já confirmado ou a pagar na entrega) e ainda não impressos.
 * Também marca o contato do programa, para o painel mostrar a impressora conectada.
 */
export async function pedidosParaImprimir(db: DB, loja: { id: number; nome: string }, agora = new Date()): Promise<PedidoParaImprimir[]> {
  await db.update(schema.lojas).set({ impressoraVistaEm: agora }).where(eq(schema.lojas.id, loja.id));
  const P = schema.pedidos;
  const ids = await db
    .select({ id: P.id })
    .from(P)
    .where(and(eq(P.lojaId, loja.id), eq(P.status, "novo"), isNull(P.impressoEm)))
    .orderBy(asc(P.numero))
    .limit(10);
  const pedidos: PedidoParaImprimir[] = [];
  for (const { id } of ids) {
    const p = await pedidoComItens(db, { id });
    if (p) pedidos.push({ id: p.id, numero: p.numero, linhas: montarComprovante(loja.nome, p) });
  }
  return pedidos;
}

export async function confirmarImpressao(db: DB, lojaId: number, pedidoId: number, agora = new Date()): Promise<boolean> {
  const r = await db
    .update(schema.pedidos)
    .set({ impressoEm: agora })
    .where(and(eq(schema.pedidos.id, pedidoId), eq(schema.pedidos.lojaId, lojaId), isNull(schema.pedidos.impressoEm)))
    .returning({ id: schema.pedidos.id });
  return r.length > 0;
}

/** Contato nos últimos 30 s: o programa consulta a cada poucos segundos. */
export function impressoraConectada(vistaEm: Date | null, agora = new Date()): boolean {
  return !!vistaEm && agora.getTime() - vistaEm.getTime() < 30_000;
}
