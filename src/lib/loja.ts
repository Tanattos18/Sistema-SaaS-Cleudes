import { and, asc, eq } from "drizzle-orm";
import { schema, type DB } from "@/db";
import type { RegrasLoja } from "./pedido";

export type Loja = typeof schema.lojas.$inferSelect;

export async function lojaPorSlug(db: DB, slug: string): Promise<Loja | undefined> {
  const [loja] = await db
    .select()
    .from(schema.lojas)
    .where(and(eq(schema.lojas.slug, slug.toLowerCase()), eq(schema.lojas.ativo, true)));
  return loja;
}

export function regrasDaLoja(loja: Loja): RegrasLoja {
  return {
    pedidoMinimo: loja.pedidoMinimo,
    modoTaxa: loja.modoTaxa,
    taxaFixa: loja.taxaFixa,
    freteGratisAcima: loja.freteGratisAcima,
    // Sem Mercado Pago configurado, as opções de pagar no site nem aparecem.
    formasPagamento: loja.formasPagamento.filter((f) => !f.startsWith("online_") || !!loja.mpAccessToken),
  };
}

export async function horariosDaLoja(db: DB, lojaId: number) {
  return db
    .select({ diaSemana: schema.horarios.diaSemana, abre: schema.horarios.abre, fecha: schema.horarios.fecha })
    .from(schema.horarios)
    .where(eq(schema.horarios.lojaId, lojaId))
    .orderBy(asc(schema.horarios.diaSemana), asc(schema.horarios.abre));
}

export async function bairrosAtivos(db: DB, lojaId: number) {
  return db
    .select({ id: schema.bairros.id, nome: schema.bairros.nome, taxa: schema.bairros.taxa })
    .from(schema.bairros)
    .where(and(eq(schema.bairros.lojaId, lojaId), eq(schema.bairros.ativo, true)))
    .orderBy(asc(schema.bairros.nome));
}

/** Endereço público do site, para links no WhatsApp e retorno do Mercado Pago. */
export function urlDoSite(): string {
  // Na Vercel, sem SITE_URL, usa o domínio de produção do projeto (ex.: pedidos.vercel.app).
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.SITE_URL ?? (vercel ? `https://${vercel}` : "http://localhost:3000")).replace(/\/$/, "");
}

