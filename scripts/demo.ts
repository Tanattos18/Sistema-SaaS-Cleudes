import { eq } from "drizzle-orm";
import { fecharDb, getDb, schema } from "../src/db";
import { CATALOGO } from "./catalogo-demo";

/**
 * Catálogo fictício de demonstração (~500 produtos) para a loja "caixeta".
 * Só roda se a loja ainda não tiver produtos. Os produtos reais virão da planilha do cliente.
 * Uso: npm run db:seed && npm run db:demo
 */

async function main() {
  const db = await getDb();
  const [loja] = await db.select().from(schema.lojas).where(eq(schema.lojas.slug, "caixeta"));
  if (!loja) throw new Error("Rode antes: npm run db:seed");
  const existentes = await db.select({ id: schema.produtos.id }).from(schema.produtos).where(eq(schema.produtos.lojaId, loja.id)).limit(1);
  if (existentes.length) {
    console.log("A loja já tem produtos; nada a fazer.");
    await fecharDb();
    process.exit(0);
  }

  let n = 0;
  for (const [ordem, cat] of CATALOGO.entries()) {
    const [c] = await db.insert(schema.categorias).values({ lojaId: loja.id, nome: cat.nome, icone: cat.icone, ordem }).returning();
    await db.insert(schema.produtos).values(
      cat.itens.map(([nome, preco, extra]) => ({
        lojaId: loja.id,
        categoriaId: c.id,
        codigo: `DEMO-${String(++n).padStart(4, "0")}`,
        nome,
        unidade: extra?.kg ? ("kg" as const) : ("un" as const),
        preco: Math.round(preco * 100) / 100,
        precoDe: extra?.de ?? null,
        precoVasilhame: extra?.vasilhame ?? null,
      })),
    );
  }
  console.log(`${n} produtos de demonstração em ${CATALOGO.length} categorias.`);
  await fecharDb();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
