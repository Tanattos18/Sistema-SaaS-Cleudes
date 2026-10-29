import { and, eq } from "drizzle-orm";
import { schema, type DB } from "@/db";
import type { LinhaProduto } from "./importacao";
import { hojeISO } from "./formato";

export type ResumoImportacao = { criados: number; atualizados: number; agendados: number; categoriasNovas: string[] };

const chaveNome = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Grava a planilha validada. Produto existente é achado pelo código (ou, sem código, pelo nome).
 * Com `vigenteEm` no futuro, o preço novo de produto existente vira agendamento (vale a partir da data);
 * os demais dados (nome, categoria, disponível) mudam na hora. Produto novo já entra com o preço da planilha.
 */
export async function importarProdutos(
  db: DB,
  lojaId: number,
  usuarioId: number,
  linhas: LinhaProduto[],
  vigenteEm: string | null,
): Promise<ResumoImportacao> {
  const agendar = vigenteEm != null && vigenteEm > hojeISO();
  const resumo: ResumoImportacao = { criados: 0, atualizados: 0, agendados: 0, categoriasNovas: [] };

  await db.transaction(async (tx) => {
    const cats = await tx.select({ id: schema.categorias.id, nome: schema.categorias.nome, ordem: schema.categorias.ordem }).from(schema.categorias).where(eq(schema.categorias.lojaId, lojaId));
    const categoria = new Map(cats.map((c) => [chaveNome(c.nome), c.id]));
    let ordem = Math.max(0, ...cats.map((c) => c.ordem));

    const existentes = await tx
      .select({ id: schema.produtos.id, codigo: schema.produtos.codigo, nome: schema.produtos.nome, preco: schema.produtos.preco })
      .from(schema.produtos)
      .where(eq(schema.produtos.lojaId, lojaId));
    const porCodigo = new Map(existentes.filter((p) => p.codigo).map((p) => [p.codigo!, p]));
    const porNome = new Map(existentes.map((p) => [chaveNome(p.nome), p]));

    for (const l of linhas) {
      let categoriaId = categoria.get(chaveNome(l.categoria));
      if (!categoriaId) {
        const [nova] = await tx.insert(schema.categorias).values({ lojaId, nome: l.categoria, ordem: ++ordem }).returning({ id: schema.categorias.id });
        categoriaId = nova.id;
        categoria.set(chaveNome(l.categoria), categoriaId);
        resumo.categoriasNovas.push(l.categoria);
      }

      const atual = l.codigo ? porCodigo.get(l.codigo) : porNome.get(chaveNome(l.nome));
      const dados = {
        nome: l.nome,
        categoriaId,
        unidade: l.unidade,
        precoVasilhame: l.precoVasilhame,
        disponivel: l.disponivel,
        descricao: l.descricao,
        ativo: true,
      };
      if (!atual) {
        await tx.insert(schema.produtos).values({ ...dados, lojaId, codigo: l.codigo, preco: l.preco, precoDe: l.precoDe });
        resumo.criados++;
        continue;
      }
      if (agendar && l.preco !== atual.preco) {
        await tx.update(schema.produtos).set(dados).where(and(eq(schema.produtos.id, atual.id), eq(schema.produtos.lojaId, lojaId)));
        await tx.insert(schema.precosAgendados).values({ produtoId: atual.id, preco: l.preco, vigenteEm: vigenteEm!, promocao: l.precoDe != null, usuarioId });
        resumo.agendados++;
      } else {
        await tx
          .update(schema.produtos)
          .set({ ...dados, preco: l.preco, precoDe: l.precoDe, ...(l.codigo ? { codigo: l.codigo } : {}) })
          .where(and(eq(schema.produtos.id, atual.id), eq(schema.produtos.lojaId, lojaId)));
      }
      resumo.atualizados++;
    }
  });
  return resumo;
}
