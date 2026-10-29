import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/db";
import { situacaoLoja } from "@/lib/horario";
import { bairrosAtivos, horariosDaLoja, lojaPorSlug, regrasDaLoja } from "@/lib/loja";
import { aplicarPrecosAgendados } from "@/lib/precos";
import { Vitrine, type DadosVitrine } from "./vitrine";

export async function generateMetadata({ params }: PageProps<"/[loja]">) {
  const { loja: slug } = await params;
  const loja = await lojaPorSlug(await getDb(), slug);
  if (!loja) return { title: "Loja não encontrada" };
  return {
    title: `${loja.nome} — Faça seu pedido`,
    description: loja.mensagemBoasVindas ?? `Peça pelo celular e receba em casa.`,
    manifest: `/${loja.slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: loja.nome.split(" ").at(-1), statusBarStyle: "default" },
  };
}

export default async function LojaPage({ params }: PageProps<"/[loja]">) {
  const { loja: slug } = await params;
  const db = await getDb();
  const loja = await lojaPorSlug(db, slug);
  if (!loja) notFound();
  await aplicarPrecosAgendados(db, loja.id);

  const [categorias, produtos, horarios, bairros] = await Promise.all([
    db
      .select({ id: schema.categorias.id, nome: schema.categorias.nome, icone: schema.categorias.icone })
      .from(schema.categorias)
      .where(and(eq(schema.categorias.lojaId, loja.id), eq(schema.categorias.ativo, true)))
      .orderBy(asc(schema.categorias.ordem), asc(schema.categorias.nome)),
    db
      .select({
        id: schema.produtos.id,
        categoriaId: schema.produtos.categoriaId,
        nome: schema.produtos.nome,
        descricao: schema.produtos.descricao,
        unidade: schema.produtos.unidade,
        preco: schema.produtos.preco,
        precoDe: schema.produtos.precoDe,
        precoVasilhame: schema.produtos.precoVasilhame,
        imagemUrl: schema.produtos.imagemUrl,
        disponivel: schema.produtos.disponivel,
      })
      .from(schema.produtos)
      .where(and(eq(schema.produtos.lojaId, loja.id), eq(schema.produtos.ativo, true)))
      .orderBy(asc(schema.produtos.nome)),
    horariosDaLoja(db, loja.id),
    bairrosAtivos(db, loja.id),
  ]);

  const dados: DadosVitrine = {
    loja: { slug: loja.slug, nome: loja.nome, mensagem: loja.mensagemBoasVindas, endereco: loja.endereco, whatsapp: loja.whatsapp },
    regras: regrasDaLoja(loja),
    situacao: situacaoLoja(horarios),
    horarios,
    bairros,
    categorias,
    produtos: produtos.map((p) => ({ ...p, ativo: true })),
  };
  return <Vitrine dados={dados} />;
}
