import { and, asc, eq, inArray, isNull, lte } from "drizzle-orm";
import { schema, type DB } from "@/db";
import { hojeISO } from "./formato";

/**
 * Aplica as mudanças de preço cuja data já chegou (ex.: promoção agendada ontem para hoje).
 * Chamada ao abrir a vitrine e ao fechar um pedido, então não depende de tarefa agendada.
 * Se houver mais de uma para o mesmo produto, vale a de data mais recente.
 */
export async function aplicarPrecosAgendados(db: DB, lojaId: number, hoje = hojeISO()): Promise<number> {
  const P = schema.precosAgendados;
  const pendentes = await db
    .select({ id: P.id, produtoId: P.produtoId, preco: P.preco, promocao: P.promocao, precoAtual: schema.produtos.preco })
    .from(P)
    .innerJoin(schema.produtos, eq(schema.produtos.id, P.produtoId))
    .where(and(eq(schema.produtos.lojaId, lojaId), isNull(P.aplicadoEm), lte(P.vigenteEm, hoje)))
    .orderBy(asc(P.vigenteEm), asc(P.id));
  if (pendentes.length === 0) return 0;

  const ultimo = new Map<number, (typeof pendentes)[number]>();
  for (const p of pendentes) ultimo.set(p.produtoId, p);

  await db.transaction(async (tx) => {
    for (const p of ultimo.values()) {
      await tx
        .update(schema.produtos)
        .set({ preco: p.preco, precoDe: p.promocao && p.precoAtual > p.preco ? p.precoAtual : null })
        .where(eq(schema.produtos.id, p.produtoId));
    }
    await tx.update(P).set({ aplicadoEm: new Date() }).where(inArray(P.id, pendentes.map((p) => p.id)));
  });
  return ultimo.size;
}
