"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { exigirUsuario } from "@/lib/auth";
import { lerForm, zId, type EstadoAcao } from "@/lib/form";

const Categoria = z.object({
  id: zId.optional(),
  nome: z.string().min(2, "informe o nome").max(60),
  icone: z.string().max(8).optional(),
  ordem: z.coerce.number().int().min(0).max(999).default(0),
  ativo: z.string().optional(),
});

export async function salvarCategoria(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, Categoria);
  if (!dados) return { erro };
  const db = await getDb();
  const C = schema.categorias;
  const [mesmoNome] = await db.select({ id: C.id }).from(C).where(and(eq(C.lojaId, usuario.lojaId), eq(C.nome, dados.nome)));
  if (mesmoNome && mesmoNome.id !== dados.id) return { erro: "Já existe uma categoria com esse nome." };

  const registro = { nome: dados.nome, icone: dados.icone ?? null, ordem: dados.ordem, ativo: dados.id ? dados.ativo === "on" : true };
  if (dados.id) {
    await db.update(C).set(registro).where(and(eq(C.id, dados.id), eq(C.lojaId, usuario.lojaId)));
    await auditar(db, usuario.lojaId, usuario.uid, "editar", "categoria", dados.id, registro);
  } else {
    const [nova] = await db.insert(C).values({ ...registro, lojaId: usuario.lojaId }).returning();
    await auditar(db, usuario.lojaId, usuario.uid, "criar", "categoria", nova.id, registro);
  }
  revalidatePath("/painel/categorias");
  return { ok: dados.id ? "Categoria salva." : "Categoria criada." };
}

/** Só apaga categoria vazia; com produtos, o caminho é desativar. */
export async function excluirCategoria(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = Number(formData.get("id"));
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(schema.produtos).where(eq(schema.produtos.categoriaId, id));
  if (n > 0) return;
  await db.delete(schema.categorias).where(and(eq(schema.categorias.id, id), eq(schema.categorias.lojaId, usuario.lojaId)));
  await auditar(db, usuario.lojaId, usuario.uid, "excluir", "categoria", id);
  revalidatePath("/painel/categorias");
}
