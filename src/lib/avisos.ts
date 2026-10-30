import { and, eq, isNull } from "drizzle-orm";
import { after } from "next/server";
import { schema, type DB } from "@/db";
import { pedidoComItens } from "./consultas";
import { ROTULO_PAGAMENTO } from "./dominio";
import { moeda } from "./formato";
import { urlDoSite } from "./loja";
import { notificarLoja, type MensagemPush } from "./push";
import { enviarWhatsappOficial, whatsappConfigurado, type DadosAviso } from "./whatsapp-meta";

/**
 * Avisos de pedido para o dono da loja, sem ninguém apertar nada. Cada pedido liberado (na entrega,
 * na hora; pago no site, depois de aprovado) vira:
 * - notificação no painel, em cada celular ou computador que ativou os avisos;
 * - mensagem no WhatsApp da loja, pela API oficial da Meta, se a loja ligou essa opção.
 */

type LojaAviso = { id: number; nome: string; whatsapp: string; avisoWhatsappAtivo: boolean };

export function mensagemPush(d: DadosAviso, pedidoId: number): MensagemPush {
  if (!pedidoId) return { title: "🔔 Aviso de teste", body: `Os avisos de pedido da ${d.loja} estão funcionando neste aparelho.`, tag: "teste", url: "/painel" };
  return {
    title: `🛒 Novo pedido nº ${d.numero} · ${d.total}`,
    body: `${d.cliente} · ${d.bairro} · ${d.pagamento}`,
    tag: `pedido-${d.numero}`,
    url: `/painel/pedidos/${pedidoId}`,
  };
}

/** Envia pelos dois canais; devolve quantos aparelhos receberam e o erro do WhatsApp, se houver. */
export async function enviarAvisos(db: DB, loja: LojaAviso, dados: DadosAviso, pedidoId: number) {
  const [aparelhos, erroWhatsapp] = await Promise.all([
    notificarLoja(db, loja.id, mensagemPush(dados, pedidoId), urlDoSite()),
    loja.avisoWhatsappAtivo && whatsappConfigurado() ? enviarWhatsappOficial(loja.whatsapp, dados) : Promise.resolve(undefined),
  ]);
  if (erroWhatsapp) console.error("WhatsApp oficial:", erroWhatsapp);
  return { aparelhos, whatsapp: erroWhatsapp === undefined ? "desligado" : erroWhatsapp === null ? "enviado" : erroWhatsapp };
}

async function avisar(db: DB, loja: LojaAviso, pedidoId: number) {
  // Marca antes de enviar: dois avisos do Mercado Pago ao mesmo tempo não avisam duas vezes.
  const marcados = await db
    .update(schema.pedidos)
    .set({ whatsappAvisadoEm: new Date() })
    .where(and(eq(schema.pedidos.id, pedidoId), eq(schema.pedidos.lojaId, loja.id), isNull(schema.pedidos.whatsappAvisadoEm)))
    .returning({ id: schema.pedidos.id });
  if (!marcados.length) return;
  const p = await pedidoComItens(db, { id: pedidoId });
  if (!p) return;
  const dados: DadosAviso = {
    numero: p.numero,
    loja: loja.nome,
    total: moeda(p.total),
    pagamento: `${ROTULO_PAGAMENTO[p.formaPagamento]}${p.pagoEm ? " (pago)" : ""}`,
    cliente: p.clienteNome,
    bairro: p.bairro,
    link: `${urlDoSite()}/painel/pedidos/${p.id}`,
  };
  const r = await enviarAvisos(db, loja, dados, p.id);
  // Nada chegou a lugar nenhum: desmarca, para a próxima confirmação do pagamento tentar de novo.
  if (r.aparelhos === 0 && r.whatsapp !== "enviado") await db.update(schema.pedidos).set({ whatsappAvisadoEm: null }).where(eq(schema.pedidos.id, pedidoId));
}

/** Agenda os avisos para depois da resposta (o cliente não espera); fora de uma requisição, envia na hora. */
export async function avisarLoja(db: DB, loja: LojaAviso, pedidoId: number) {
  const tarefa = () => avisar(db, loja, pedidoId).catch((e) => console.error("Avisos do pedido:", (e as Error).message));
  try {
    after(tarefa);
  } catch {
    await tarefa();
  }
}
