"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { FormaPagamento } from "@/db/schema";
import { auditar } from "@/lib/auditoria";
import { exigirAdmin } from "@/lib/auth";
import { FORMAS_DISPONIVEIS, normalizarTelefone } from "@/lib/dominio";
import { lerForm, zId, zTexto, zValor, type EstadoAcao } from "@/lib/form";

function revalidarLoja() {
  revalidatePath("/painel/configuracoes");
  revalidatePath("/", "layout");
}

const Loja = z.object({
  nome: z.string().min(2, "informe o nome da loja").max(80),
  whatsapp: z.string().min(8, "informe o WhatsApp da loja"),
  endereco: zTexto,
  mensagemBoasVindas: z.string().max(200).optional(),
  pedidoMinimo: zValor.default(0),
  modoTaxa: z.enum(["fixa", "bairro"]),
  taxaFixa: zValor.default(0),
  freteGratisAcima: zValor.optional(),
});

export async function salvarLoja(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  const { dados, erro } = lerForm(formData, Loja);
  if (!dados) return { erro };
  const whatsapp = normalizarTelefone(dados.whatsapp);
  if (!whatsapp) return { erro: "WhatsApp inválido: use o DDD, ex.: (62) 98177-9460." };
  const formas = formData.getAll("formasPagamento").map(String).filter((f): f is FormaPagamento => (FORMAS_DISPONIVEIS as readonly string[]).includes(f));
  if (formas.length === 0) return { erro: "Deixe pelo menos uma forma de pagamento ligada." };

  const db = await getDb();
  if (dados.modoTaxa === "bairro") {
    const [{ n }] = await db.select({ n: count() }).from(schema.bairros).where(and(eq(schema.bairros.lojaId, admin.lojaId), eq(schema.bairros.ativo, true)));
    if (n === 0) return { erro: "Para cobrar por bairro, cadastre antes pelo menos um bairro (mais abaixo nesta página)." };
  }
  const registro = {
    nome: dados.nome,
    whatsapp,
    endereco: dados.endereco ?? null,
    mensagemBoasVindas: dados.mensagemBoasVindas ?? null,
    pedidoMinimo: dados.pedidoMinimo,
    modoTaxa: dados.modoTaxa,
    taxaFixa: dados.taxaFixa,
    freteGratisAcima: dados.freteGratisAcima ?? null,
    formasPagamento: formas,
  };
  await db.update(schema.lojas).set(registro).where(eq(schema.lojas.id, admin.lojaId));
  await auditar(db, admin.lojaId, admin.uid, "editar", "loja", admin.lojaId, registro);
  revalidarLoja();
  return { ok: "Configurações salvas. A loja já mostra as mudanças." };
}

const hora = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Um horário por dia da semana; dia desmarcado = fechado. */
export async function salvarHorarios(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  const novos: { lojaId: number; diaSemana: number; abre: string; fecha: string }[] = [];
  for (let dia = 0; dia < 7; dia++) {
    if (formData.get(`aberto-${dia}`) !== "on") continue;
    const abre = String(formData.get(`abre-${dia}`) ?? "");
    const fecha = String(formData.get(`fecha-${dia}`) ?? "");
    if (!hora.test(abre) || !hora.test(fecha)) return { erro: "Preencha os horários no formato 06:00." };
    if (fecha <= abre) return { erro: "O horário de fechar precisa ser depois do de abrir (no mesmo dia)." };
    novos.push({ lojaId: admin.lojaId, diaSemana: dia, abre, fecha });
  }
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(schema.horarios).where(eq(schema.horarios.lojaId, admin.lojaId));
    if (novos.length) await tx.insert(schema.horarios).values(novos);
  });
  await auditar(db, admin.lojaId, admin.uid, "editar", "horarios", admin.lojaId, novos);
  revalidarLoja();
  return { ok: novos.length ? "Horários salvos." : "Horários salvos: a loja ficou fechada todos os dias." };
}

const Bairro = z.object({
  id: zId.optional(),
  nome: z.string().min(2, "informe o bairro").max(80),
  taxa: zValor,
  ativo: z.string().optional(),
});

export async function salvarBairro(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  const { dados, erro } = lerForm(formData, Bairro);
  if (!dados) return { erro };
  const db = await getDb();
  const B = schema.bairros;
  const [mesmo] = await db.select({ id: B.id }).from(B).where(and(eq(B.lojaId, admin.lojaId), eq(B.nome, dados.nome)));
  if (mesmo && mesmo.id !== dados.id) return { erro: "Esse bairro já está cadastrado." };
  const registro = { nome: dados.nome, taxa: dados.taxa, ativo: dados.id ? dados.ativo === "on" : true };
  if (dados.id) await db.update(B).set(registro).where(and(eq(B.id, dados.id), eq(B.lojaId, admin.lojaId)));
  else await db.insert(B).values({ ...registro, lojaId: admin.lojaId });
  await auditar(db, admin.lojaId, admin.uid, dados.id ? "editar" : "criar", "bairro", dados.id ?? null, registro);
  revalidarLoja();
  return { ok: dados.id ? "Bairro salvo." : "Bairro cadastrado." };
}

/** Bairro com pedidos fica no histórico: só desativa. Sem pedidos, apaga. */
export async function excluirBairro(formData: FormData) {
  const admin = await exigirAdmin();
  const id = Number(formData.get("id"));
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(schema.pedidos).where(eq(schema.pedidos.bairroId, id));
  const B = schema.bairros;
  if (n > 0) await db.update(B).set({ ativo: false }).where(and(eq(B.id, id), eq(B.lojaId, admin.lojaId)));
  else await db.delete(B).where(and(eq(B.id, id), eq(B.lojaId, admin.lojaId)));
  await auditar(db, admin.lojaId, admin.uid, n > 0 ? "desativar" : "excluir", "bairro", id);
  revalidarLoja();
}

/** Troca a chave do programa de impressão (ex.: PC trocado ou chave vazada). O programa antigo para de funcionar. */
export async function gerarNovaChaveImpressao() {
  const admin = await exigirAdmin();
  const { randomBytes } = await import("node:crypto");
  const db = await getDb();
  await db
    .update(schema.lojas)
    .set({ tokenImpressao: randomBytes(24).toString("base64url"), impressoraVistaEm: null })
    .where(eq(schema.lojas.id, admin.lojaId));
  await auditar(db, admin.lojaId, admin.uid, "nova_chave", "impressora", admin.lojaId);
  revalidatePath("/painel/configuracoes");
}
