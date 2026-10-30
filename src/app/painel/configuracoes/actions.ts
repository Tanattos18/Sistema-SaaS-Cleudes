"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { FormaPagamento } from "@/db/schema";
import { auditar } from "@/lib/auditoria";
import { exigirAdmin } from "@/lib/auth";
import { FORMAS_OFERECIDAS, normalizarTelefone } from "@/lib/dominio";
import { contaDoToken } from "@/lib/mercadopago";
import { cifrar } from "@/lib/segredo";
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
  if (!whatsapp) return { erro: "WhatsApp inválido: use o DDD, ex.: (62) 99999-0000." };
  const formas = formData.getAll("formasPagamento").map(String).filter((f): f is FormaPagamento => (FORMAS_OFERECIDAS as readonly string[]).includes(f));
  const db = await getDb();
  const [{ mp }] = await db.select({ mp: schema.lojas.mpAccessToken }).from(schema.lojas).where(eq(schema.lojas.id, admin.lojaId));
  // Pix e cartão só valem com o Mercado Pago conectado; sem ele, precisa sobrar uma forma de pagar na entrega.
  if (!formas.some((f) => !f.startsWith("online_") || mp)) return { erro: "Deixe pelo menos uma forma de pagamento ligada (sem o Mercado Pago conectado, dinheiro ou maquininha)." };

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
const Impressora = z.object({
  tipo: z.enum(["windows", "comum", "rede"]),
  nome: z.string().trim().max(200).optional(),
  ip: z.string().trim().max(60).optional(),
  porta: z.coerce.number().int().min(1).max(65535).optional(),
  copias: z.coerce.number().int().min(1).max(5),
});

/** Impressora escolhida no painel: o programa do balcão passa a usar esta na próxima consulta. */
export async function salvarImpressora(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  const r = Impressora.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => v !== "")));
  if (!r.success) return { erro: "Confira os dados da impressora." };
  const d = r.data;
  if (d.tipo === "rede" && !/^[\w.-]+$/.test(d.ip ?? "")) return { erro: "Informe o IP da impressora de rede (ex.: 192.168.0.100)." };
  if (d.tipo !== "rede" && !d.nome) return { erro: "Escolha a impressora na lista (ou digite o nome exato dela no Windows)." };
  const db = await getDb();
  await db
    .update(schema.lojas)
    .set({
      impressoraTipo: d.tipo,
      impressoraNome: d.tipo === "rede" ? null : d.nome,
      impressoraIp: d.tipo === "rede" ? d.ip : null,
      impressoraPorta: d.tipo === "rede" ? (d.porta ?? 9100) : null,
      impressoraCopias: d.copias,
    })
    .where(eq(schema.lojas.id, admin.lojaId));
  await auditar(db, admin.lojaId, admin.uid, "editar", "impressora", admin.lojaId, d);
  revalidatePath("/painel/configuracoes");
  return { ok: "Impressora salva. O programa do balcão troca sozinho em poucos segundos." };
}

export async function pedirTesteImpressao() {
  const admin = await exigirAdmin();
  const db = await getDb();
  await db.update(schema.lojas).set({ impressaoTestePedidaEm: new Date() }).where(eq(schema.lojas.id, admin.lojaId));
  revalidatePath("/painel/configuracoes");
}

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

/** Conecta a conta Mercado Pago da loja: confere a credencial na API e guarda criptografada. */
export async function conectarMercadoPago(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  const token = String(formData.get("token") ?? "").trim();
  if (!/^(APP_USR|TEST)-[\w-]{20,}$/.test(token)) return { erro: "Cole o Access Token completo (começa com APP_USR- ou TEST-)." };
  let conta: Awaited<ReturnType<typeof contaDoToken>>;
  try {
    conta = await contaDoToken(token);
  } catch {
    return { erro: "O Mercado Pago recusou essa credencial. Confira se copiou o Access Token certo." };
  }
  const nome = `${conta.nome}${conta.teste ? " (conta de teste)" : ""}`;
  const db = await getDb();
  await db.update(schema.lojas).set({ mpAccessToken: cifrar(token), mpConta: nome }).where(eq(schema.lojas.id, admin.lojaId));
  await auditar(db, admin.lojaId, admin.uid, "conectar", "mercadopago", admin.lojaId, { conta: nome });
  revalidarLoja();
  return { ok: `Conectado à conta ${nome}. Pix e cartão já aparecem para o cliente.` };
}

export async function salvarAssinaturaWebhook(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  const segredo = String(formData.get("segredo") ?? "").trim();
  if (segredo && !/^[\w-]{16,}$/.test(segredo)) return { erro: "Cole a assinatura secreta completa, como aparece no Mercado Pago." };
  const db = await getDb();
  await db.update(schema.lojas).set({ mpWebhookSecret: segredo ? cifrar(segredo) : null }).where(eq(schema.lojas.id, admin.lojaId));
  await auditar(db, admin.lojaId, admin.uid, segredo ? "conectar" : "desconectar", "mercadopago_webhook", admin.lojaId);
  revalidarLoja();
  return { ok: segredo ? "Assinatura salva. Avisos do Mercado Pago sem essa assinatura serão recusados." : "Assinatura removida." };
}

/** Liga ou desliga o aviso de pedidos no WhatsApp da loja (número oficial da Akylla, pela API da Meta). */
export async function ligarAvisoWhatsapp(formData: FormData) {
  const admin = await exigirAdmin();
  const ligar = formData.get("ligar") === "1";
  const db = await getDb();
  await db.update(schema.lojas).set({ avisoWhatsappAtivo: ligar }).where(eq(schema.lojas.id, admin.lojaId));
  await auditar(db, admin.lojaId, admin.uid, ligar ? "conectar" : "desconectar", "whatsapp_aviso", admin.lojaId);
  revalidatePath("/painel/configuracoes");
}

export async function desconectarMercadoPago() {
  const admin = await exigirAdmin();
  const db = await getDb();
  await db.update(schema.lojas).set({ mpAccessToken: null, mpConta: null }).where(eq(schema.lojas.id, admin.lojaId));
  await auditar(db, admin.lojaId, admin.uid, "desconectar", "mercadopago", admin.lojaId);
  revalidarLoja();
}
