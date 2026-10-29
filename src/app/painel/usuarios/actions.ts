"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { exigirAdmin, exigirLogin } from "@/lib/auth";
import { lerForm, zSenha, type EstadoAcao } from "@/lib/form";

const NovoUsuario = z.object({
  nome: z.string().min(2, "informe o nome").max(80),
  email: z.email("e-mail inválido"),
  senha: zSenha,
  perfil: z.enum(["admin", "operador"]),
});

export async function criarUsuario(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  const { dados, erro } = lerForm(formData, NovoUsuario);
  if (!dados) return { erro };
  const db = await getDb();
  const [novo] = await db
    .insert(schema.usuarios)
    .values({ lojaId: admin.lojaId, nome: dados.nome, email: dados.email.toLowerCase(), perfil: dados.perfil, senhaHash: await bcrypt.hash(dados.senha, 10), trocarSenha: true })
    .onConflictDoNothing()
    .returning();
  if (!novo) return { erro: "Já existe um usuário com esse e-mail." };
  await auditar(db, admin.lojaId, admin.uid, "criar", "usuario", novo.id, { nome: dados.nome, email: dados.email, perfil: dados.perfil });
  revalidatePath("/painel/usuarios");
  return { ok: "Usuário criado. No primeiro acesso ele troca a senha provisória." };
}

/** Ativa/desativa e muda o perfil de outro usuário da mesma loja (nunca o próprio, para não se trancar fora). */
export async function alterarUsuario(formData: FormData) {
  const admin = await exigirAdmin();
  const id = Number(formData.get("id"));
  if (id === admin.uid) return;
  const mudanca: { ativo?: boolean; perfil?: "admin" | "operador" } = {};
  if (formData.has("ativo")) mudanca.ativo = formData.get("ativo") === "true";
  const perfil = formData.get("perfil");
  if (perfil === "admin" || perfil === "operador") mudanca.perfil = perfil;
  if (!Object.keys(mudanca).length) return;
  const db = await getDb();
  await db.update(schema.usuarios).set(mudanca).where(and(eq(schema.usuarios.id, id), eq(schema.usuarios.lojaId, admin.lojaId)));
  await auditar(db, admin.lojaId, admin.uid, "editar", "usuario", id, mudanca);
  revalidatePath("/painel/usuarios");
}

const NovaSenha = z.object({ id: z.coerce.number().int().positive(), senha: zSenha });

/** Senha provisória para quem esqueceu: a pessoa troca no próximo acesso. */
export async function redefinirSenha(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  const { dados, erro } = lerForm(formData, NovaSenha);
  if (!dados) return { erro };
  const db = await getDb();
  const r = await db
    .update(schema.usuarios)
    .set({ senhaHash: await bcrypt.hash(dados.senha, 10), trocarSenha: true, ativo: true })
    .where(and(eq(schema.usuarios.id, dados.id), eq(schema.usuarios.lojaId, admin.lojaId)))
    .returning({ id: schema.usuarios.id });
  if (!r.length) return { erro: "Usuário não encontrado." };
  await auditar(db, admin.lojaId, admin.uid, "redefinir_senha", "usuario", dados.id);
  return { ok: "Senha provisória definida. Passe para a pessoa: ela troca no próximo acesso." };
}

const TrocaSenha = z.object({ atual: z.string().min(1), nova: zSenha });

export async function trocarSenha(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  // exigirLogin: precisa funcionar também com a senha provisória pendente de troca.
  const usuario = await exigirLogin();
  const { dados, erro } = lerForm(formData, TrocaSenha);
  if (!dados) return { erro };
  const db = await getDb();
  const [u] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.id, usuario.uid));
  if (!u || !(await bcrypt.compare(dados.atual, u.senhaHash))) return { erro: "Senha atual incorreta." };
  if (dados.atual === dados.nova) return { erro: "A nova senha precisa ser diferente da atual." };
  await db.update(schema.usuarios).set({ senhaHash: await bcrypt.hash(dados.nova, 10), trocarSenha: false }).where(eq(schema.usuarios.id, u.id));
  await auditar(db, u.lojaId, u.id, "trocar_senha", "usuario", u.id);
  return { ok: "Senha alterada." };
}
