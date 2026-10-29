"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { exigirUsuario } from "@/lib/auth";
import { lerForm, zData, zId, zTexto, zValor, type EstadoAcao } from "@/lib/form";
import { dataBR, hojeISO } from "@/lib/formato";
import { aplicarPrecosAgendados } from "@/lib/precos";

const Produto = z.object({
  id: zId.optional(),
  nome: z.string().min(2, "informe o nome").max(120),
  codigo: z.string().max(40).optional(),
  categoriaId: zId,
  unidade: z.enum(["un", "kg"]),
  preco: zValor.pipe(z.number().positive("o preço precisa ser maior que zero")),
  precoDe: zValor.optional(),
  precoVasilhame: zValor.optional(),
  descricao: zTexto,
  // Endereço https:// de uma foto, ou uma das fotos do próprio sistema (/produtos/...).
  imagemUrl: z.string().max(500).regex(/^(https:\/\/\S+|\/produtos\/[\w.-]+)$/, "use um endereço que comece com https://").optional(),
  disponivel: z.string().optional(),
  ativo: z.string().optional(),
});

export async function salvarProduto(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, Produto);
  if (!dados) return { erro };
  if (dados.precoVasilhame && dados.unidade === "kg") return { erro: "Produto por quilo não tem vasilhame." };
  if (dados.precoDe != null && dados.precoDe <= dados.preco) return { erro: "O preço “de” (riscado) precisa ser maior que o preço atual." };

  const db = await getDb();
  const [cat] = await db
    .select({ id: schema.categorias.id })
    .from(schema.categorias)
    .where(and(eq(schema.categorias.id, dados.categoriaId), eq(schema.categorias.lojaId, usuario.lojaId)));
  if (!cat) return { erro: "Categoria inválida." };

  const registro = {
    nome: dados.nome,
    codigo: dados.codigo || null,
    categoriaId: dados.categoriaId,
    unidade: dados.unidade,
    preco: dados.preco,
    precoDe: dados.precoDe ?? null,
    precoVasilhame: dados.precoVasilhame ?? null,
    descricao: dados.descricao ?? null,
    imagemUrl: dados.imagemUrl ?? null,
    disponivel: dados.disponivel === "on",
    ativo: dados.id ? dados.ativo === "on" : true,
  };
  const P = schema.produtos;
  if (registro.codigo) {
    const [repetido] = await db.select({ id: P.id }).from(P).where(and(eq(P.lojaId, usuario.lojaId), eq(P.codigo, registro.codigo)));
    if (repetido && repetido.id !== dados.id) return { erro: "Já existe outro produto com esse código." };
  }

  if (dados.id) {
    const [antes] = await db.select().from(P).where(and(eq(P.id, dados.id), eq(P.lojaId, usuario.lojaId)));
    if (!antes) return { erro: "Produto não encontrado." };
    await db.update(P).set(registro).where(eq(P.id, dados.id));
    await auditar(db, usuario.lojaId, usuario.uid, "editar", "produto", dados.id, { antes, depois: registro });
  } else {
    const [novo] = await db.insert(P).values({ ...registro, lojaId: usuario.lojaId }).returning();
    await auditar(db, usuario.lojaId, usuario.uid, "criar", "produto", novo.id, registro);
  }
  revalidatePath("/painel/produtos");
  redirect("/painel/produtos");
}

/** Liga/desliga "disponível" direto da lista (acabou o estoque, chegou de novo). */
export async function alternarDisponivel(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = Number(formData.get("id"));
  const disponivel = formData.get("disponivel") === "true";
  const db = await getDb();
  await db
    .update(schema.produtos)
    .set({ disponivel })
    .where(and(eq(schema.produtos.id, id), eq(schema.produtos.lojaId, usuario.lojaId)));
  await auditar(db, usuario.lojaId, usuario.uid, disponivel ? "disponivel" : "indisponivel", "produto", id);
  revalidatePath("/painel/produtos");
}

const Agendamento = z.object({
  produtoId: zId,
  preco: zValor.pipe(z.number().positive("o preço precisa ser maior que zero")),
  vigenteEm: zData,
  promocao: z.string().optional(),
});

/** Novo preço a partir de uma data (ex.: promoção de amanhã). Na data de hoje, vale na hora. */
export async function agendarPreco(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, Agendamento);
  if (!dados) return { erro };
  if (dados.vigenteEm < hojeISO()) return { erro: "A data não pode ser no passado." };
  const db = await getDb();
  const [p] = await db
    .select({ id: schema.produtos.id })
    .from(schema.produtos)
    .where(and(eq(schema.produtos.id, dados.produtoId), eq(schema.produtos.lojaId, usuario.lojaId)));
  if (!p) return { erro: "Produto não encontrado." };

  await db
    .insert(schema.precosAgendados)
    .values({ produtoId: p.id, preco: dados.preco, vigenteEm: dados.vigenteEm, promocao: dados.promocao === "on", usuarioId: usuario.uid });
  await auditar(db, usuario.lojaId, usuario.uid, "agendar_preco", "produto", p.id, { preco: dados.preco, vigenteEm: dados.vigenteEm });
  await aplicarPrecosAgendados(db, usuario.lojaId);
  revalidatePath(`/painel/produtos/${p.id}`);
  revalidatePath("/painel/precos");
  return { ok: dados.vigenteEm === hojeISO() ? "Preço aplicado agora." : `Preço agendado para ${dataBR(dados.vigenteEm)}.` };
}

export async function cancelarAgendamento(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = Number(formData.get("id"));
  const db = await getDb();
  const A = schema.precosAgendados;
  const [ag] = await db
    .select({ id: A.id, produtoId: A.produtoId })
    .from(A)
    .innerJoin(schema.produtos, eq(schema.produtos.id, A.produtoId))
    .where(and(eq(A.id, id), eq(schema.produtos.lojaId, usuario.lojaId), isNull(A.aplicadoEm)));
  if (!ag) return;
  await db.delete(A).where(eq(A.id, id));
  await auditar(db, usuario.lojaId, usuario.uid, "cancelar_preco", "produto", ag.produtoId, { agendamento: id });
  revalidatePath(`/painel/produtos/${ag.produtoId}`);
  revalidatePath("/painel/precos");
}
