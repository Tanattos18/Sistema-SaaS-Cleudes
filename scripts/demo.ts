import { and, eq, like } from "drizzle-orm";
import { fecharDb, getDb, schema } from "../src/db";
import { CATALOGO, PROMOCOES } from "./catalogo-demo";
import { fotoDoProduto } from "./fotos-demo";

const foto = (nome: string) => {
  const f = fotoDoProduto(nome);
  return f ? `/produtos/${f}.webp` : null;
};

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
    // Banco criado antes das fotos: completa as fotos e ofertas dos produtos de demonstração.
    const demo = await db
      .select({ id: schema.produtos.id, nome: schema.produtos.nome, imagemUrl: schema.produtos.imagemUrl, preco: schema.produtos.preco })
      .from(schema.produtos)
      .where(and(eq(schema.produtos.lojaId, loja.id), like(schema.produtos.codigo, "DEMO-%")));
    let n = 0;
    for (const p of demo) {
      const de = PROMOCOES[p.nome];
      if (p.imagemUrl && !de) continue;
      await db
        .update(schema.produtos)
        .set({ imagemUrl: p.imagemUrl ?? foto(p.nome), ...(de && de > p.preco ? { precoDe: de } : {}) })
        .where(eq(schema.produtos.id, p.id));
      n++;
    }
    console.log(n ? `${n} produtos de demonstração atualizados com fotos/ofertas.` : "A loja já tem produtos; nada a fazer.");
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
        precoDe: extra?.de ?? PROMOCOES[nome] ?? null,
        precoVasilhame: extra?.vasilhame ?? null,
        imagemUrl: foto(nome),
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
