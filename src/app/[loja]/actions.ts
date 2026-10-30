"use server";

import { randomBytes } from "node:crypto";
import { and, eq, inArray, max, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { FORMAS_PAGAMENTO, type FormaPagamento } from "@/db/schema";
import { normalizarTelefone, pagamentoOnline } from "@/lib/dominio";
import { situacaoLoja } from "@/lib/horario";
import { horariosDaLoja, lojaPorSlug, regrasDaLoja, urlDoSite, type Loja } from "@/lib/loja";
import { avisarLoja } from "@/lib/avisos";
import { criarPix, criarPreferencia, tokenDaLoja } from "@/lib/mercadopago";
import { calcularPedido, validarPagamento, type ProdutoCatalogo } from "@/lib/pedido";
import { aplicarPrecosAgendados } from "@/lib/precos";

const texto = (max: number) => z.string().trim().max(max);

const Pedido = z.object({
  itens: z
    .array(
      z.object({
        produtoId: z.number().int().positive(),
        quantidade: z.number().optional(),
        valor: z.number().optional(),
        temVasilhame: z.boolean().optional(),
        observacao: texto(200).optional(),
      }),
    )
    .max(150),
  cliente: z.object({
    nome: texto(80).min(2, "Informe seu nome."),
    telefone: texto(30),
    rua: texto(120).min(2, "Informe a rua."),
    numero: texto(20).min(1, "Informe o número (ou S/N)."),
    complemento: texto(80),
    bairro: texto(80),
    referencia: texto(150),
  }),
  bairroId: z.number().int().positive().nullable(),
  observacoes: texto(500),
  formaPagamento: z.enum(FORMAS_PAGAMENTO, { error: "Escolha a forma de pagamento." }),
  trocoPara: z.number().positive().nullable(),
});

/** `pagamento`: link do Mercado Pago para onde o cliente vai pagar (Pix ou cartão). */
export type ResultadoPedido = { erro: string } | { codigo: string; pagamento?: string };

export async function fecharPedido(slug: string, entrada: unknown): Promise<ResultadoPedido> {
  const parse = Pedido.safeParse(entrada);
  if (!parse.success) return { erro: parse.error.issues[0].message };
  const d = parse.data;

  const telefone = normalizarTelefone(d.cliente.telefone);
  if (!telefone) return { erro: "Informe um telefone com DDD, ex.: (62) 99999-0000." };

  const db = await getDb();
  const loja = await lojaPorSlug(db, slug);
  if (!loja) return { erro: "Loja não encontrada." };
  const situacao = situacaoLoja(await horariosDaLoja(db, loja.id));
  if (!situacao.aberta) return { erro: `${situacao.mensagem}. Não estamos recebendo pedidos agora.` };

  await aplicarPrecosAgendados(db, loja.id);
  const ids = [...new Set(d.itens.map((i) => i.produtoId))];
  const produtos = ids.length
    ? await db
        .select({
          id: schema.produtos.id,
          nome: schema.produtos.nome,
          unidade: schema.produtos.unidade,
          preco: schema.produtos.preco,
          precoVasilhame: schema.produtos.precoVasilhame,
          disponivel: schema.produtos.disponivel,
          ativo: schema.produtos.ativo,
        })
        .from(schema.produtos)
        .where(and(eq(schema.produtos.lojaId, loja.id), inArray(schema.produtos.id, ids)))
    : [];
  const catalogo = new Map<number, ProdutoCatalogo>(produtos.map((p) => [p.id, p]));

  const regras = regrasDaLoja(loja);
  let bairroNome = d.cliente.bairro;
  let taxaBairro: number | null = null;
  if (regras.modoTaxa === "bairro") {
    if (!d.bairroId) return { erro: "Escolha o seu bairro." };
    const [b] = await db
      .select()
      .from(schema.bairros)
      .where(and(eq(schema.bairros.id, d.bairroId), eq(schema.bairros.lojaId, loja.id), eq(schema.bairros.ativo, true)));
    if (!b) return { erro: "Ainda não entregamos nesse bairro." };
    bairroNome = b.nome;
    taxaBairro = b.taxa;
  } else if (bairroNome.length < 2) {
    return { erro: "Informe o bairro." };
  }

  const calc = calcularPedido(d.itens, catalogo, regras, taxaBairro);
  if (typeof calc === "string") return { erro: calc };
  const trocoPara = d.formaPagamento === "entrega_dinheiro" ? d.trocoPara : null;
  const erroPagamento = validarPagamento(regras, d.formaPagamento, calc.total, trocoPara, !!tokenDaLoja(loja));
  if (erroPagamento) return { erro: erroPagamento };

  const codigo = randomBytes(12).toString("base64url");
  const { numero, id } = await db.transaction(async (tx) => {
    // Trava a loja para dois pedidos simultâneos não pegarem o mesmo número.
    await tx.execute(sql`select id from lojas where id = ${loja.id} for update`);
    const [{ ultimo }] = await tx
      .select({ ultimo: max(schema.pedidos.numero) })
      .from(schema.pedidos)
      .where(eq(schema.pedidos.lojaId, loja.id));
    const [pedido] = await tx
      .insert(schema.pedidos)
      .values({
        lojaId: loja.id,
        numero: (ultimo ?? 0) + 1,
        codigo,
        // Pago no site: só vira "novo" (e imprime) quando o Mercado Pago confirmar.
        status: pagamentoOnline(d.formaPagamento) ? "aguardando_pagamento" : "novo",
        clienteNome: d.cliente.nome,
        clienteTelefone: telefone,
        rua: d.cliente.rua,
        numeroEndereco: d.cliente.numero,
        complemento: d.cliente.complemento || null,
        bairro: bairroNome,
        bairroId: regras.modoTaxa === "bairro" ? d.bairroId : null,
        referencia: d.cliente.referencia || null,
        observacoes: d.observacoes || null,
        formaPagamento: d.formaPagamento,
        trocoPara,
        subtotal: calc.subtotal,
        taxaEntrega: calc.taxaEntrega,
        total: calc.total,
      })
      .returning({ id: schema.pedidos.id });
    await tx.insert(schema.pedidoItens).values(calc.itens.map((i) => ({ ...i, pedidoId: pedido.id })));
    return { numero: (ultimo ?? 0) + 1, id: pedido.id };
  });
  if (!pagamentoOnline(d.formaPagamento)) {
    // Pagamento na entrega: o pedido já está liberado, então a loja é avisada agora.
    await avisarLoja(db, loja, id);
    return { codigo };
  }

  const aberto = await abrirPagamento(loja, { numero, codigo, total: calc.total }, d.formaPagamento);
  if (!aberto) {
    await db
      .update(schema.pedidos)
      .set({ status: "cancelado", canceladoMotivo: "Não foi possível abrir o pagamento no Mercado Pago." })
      .where(eq(schema.pedidos.codigo, codigo));
    return { erro: "Não foi possível abrir o pagamento agora. Tente de novo ou escolha pagar na entrega." };
  }
  return { codigo, pagamento: aberto.link };
}

/**
 * Cria o pagamento no Mercado Pago e guarda a referência no pedido; null se o Mercado Pago falhar.
 * Pix: gera o QR code aqui mesmo (sem link; o cliente paga na página do pedido). Cartão: link do Checkout Pro.
 */
async function abrirPagamento(loja: Loja, pedido: { numero: number; codigo: string; total: number }, forma: FormaPagamento): Promise<{ link?: string } | null> {
  const token = tokenDaLoja(loja);
  if (!token) return null;
  try {
    const db = await getDb();
    if (forma === "online_pix") {
      const pix = await criarPix(token, pedido, loja, urlDoSite());
      await db
        .update(schema.pedidos)
        .set({ mpOrdemId: pix.ordemId, pixCopiaECola: pix.copiaECola, pixQrCode: pix.qrCode, pixExpiraEm: pix.expiraEm })
        .where(eq(schema.pedidos.codigo, pedido.codigo));
      return {};
    }
    const p = await criarPreferencia(token, pedido, loja, forma, urlDoSite());
    await db.update(schema.pedidos).set({ mpPreferenciaId: p.id }).where(eq(schema.pedidos.codigo, pedido.codigo));
    return { link: p.link };
  } catch (e) {
    console.error("Mercado Pago:", (e as Error).message);
    return null;
  }
}

/** Novo Pix ou novo link do cartão para um pedido que ainda aguarda (o anterior expira em 30 minutos). */
export async function pagarDeNovo(slug: string, codigo: string): Promise<ResultadoPedido> {
  const db = await getDb();
  const loja = await lojaPorSlug(db, slug);
  if (!loja) return { erro: "Loja não encontrada." };
  const [p] = await db
    .select({ numero: schema.pedidos.numero, total: schema.pedidos.total, status: schema.pedidos.status, forma: schema.pedidos.formaPagamento })
    .from(schema.pedidos)
    .where(and(eq(schema.pedidos.codigo, codigo), eq(schema.pedidos.lojaId, loja.id)));
  if (!p || p.status !== "aguardando_pagamento" || !pagamentoOnline(p.forma)) return { erro: "Este pedido não está aguardando pagamento." };
  const aberto = await abrirPagamento(loja, { numero: p.numero, codigo, total: p.total }, p.forma);
  return aberto ? { codigo, pagamento: aberto.link } : { erro: "Não foi possível abrir o pagamento agora. Tente de novo em instantes." };
}
