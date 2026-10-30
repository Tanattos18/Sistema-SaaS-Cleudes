import { and, eq, isNull } from "drizzle-orm";
import { after } from "next/server";
import { schema, type DB } from "@/db";
import { paraMensagem, pedidoComItens } from "./consultas";
import { urlDoSite } from "./loja";
import { decifrar } from "./segredo";
import { mensagemPedido } from "./whatsapp";

/**
 * Aviso automático de pedido no WhatsApp da loja, pelo CallMeBot (o mesmo da Akylla Shop): sem
 * ninguém apertar nada, cada pedido liberado (na entrega, na hora; pago no site, depois de aprovado)
 * chega como mensagem no WhatsApp cadastrado. O dono ativa uma vez pelo WhatsApp e cola a chave
 * em Configurações. É gratuito e não oficial; a alternativa oficial é a API do WhatsApp da Meta.
 */

const CALLMEBOT = () => (process.env.CALLMEBOT_API ?? "https://api.callmebot.com").replace(/\/$/, "");

/** O CallMeBot recebe o texto na URL; pedidos muito grandes vão resumidos, com o link do pedido completo. */
export const LIMITE_TEXTO = 1500;

export function textoDoAviso(mensagem: string, link: string): string {
  const texto = `🛒 *NOVO PEDIDO PELO SITE*\n\n${mensagem}`;
  if (texto.length <= LIMITE_TEXTO) return texto;
  const fim = `\n\n_(pedido longo: veja todos os itens em ${link})_`;
  return texto.slice(0, LIMITE_TEXTO - fim.length).replace(/\n[^\n]*$/, "") + fim;
}

export function urlCallMeBot(telefone: string, apiKey: string, texto: string): string {
  return `${CALLMEBOT()}/whatsapp.php?phone=${encodeURIComponent(telefone)}&text=${encodeURIComponent(texto)}&apikey=${encodeURIComponent(apiKey)}`;
}

/** Manda uma mensagem; devolve true se o CallMeBot aceitou. */
export async function enviarCallMeBot(telefone: string, apiKey: string, texto: string): Promise<boolean> {
  try {
    const r = await fetch(urlCallMeBot(telefone, apiKey, texto), { signal: AbortSignal.timeout(15000) });
    const corpo = await r.text().catch(() => "");
    // O CallMeBot responde 200 mesmo com chave errada; o texto da resposta diz se foi enfileirado.
    return r.ok && !/apikey is invalid|not activated|error/i.test(corpo);
  } catch (e) {
    console.error("Aviso no WhatsApp falhou:", (e as Error).message);
    return false;
  }
}

async function enviarAviso(db: DB, loja: { id: number; slug: string; whatsapp: string; callmebotApiKey: string | null }, pedidoId: number) {
  const chave = decifrar(loja.callmebotApiKey);
  if (!chave) return;
  // Marca antes de enviar: dois avisos do Mercado Pago ao mesmo tempo não mandam a mensagem duas vezes.
  const marcados = await db
    .update(schema.pedidos)
    .set({ whatsappAvisadoEm: new Date() })
    .where(and(eq(schema.pedidos.id, pedidoId), eq(schema.pedidos.lojaId, loja.id), isNull(schema.pedidos.whatsappAvisadoEm)))
    .returning({ id: schema.pedidos.id });
  if (!marcados.length) return;
  const pedido = await pedidoComItens(db, { id: pedidoId });
  if (!pedido) return;
  const link = `${urlDoSite()}/${loja.slug}/pedido/${pedido.codigo}`;
  const ok = await enviarCallMeBot(loja.whatsapp, chave, textoDoAviso(mensagemPedido(paraMensagem(pedido), link), link));
  // Falhou: desmarca, para a próxima confirmação do pagamento tentar de novo.
  if (!ok) await db.update(schema.pedidos).set({ whatsappAvisadoEm: null }).where(eq(schema.pedidos.id, pedidoId));
}

/** Agenda o aviso para depois da resposta (o cliente não espera o WhatsApp); fora de uma requisição, envia na hora. */
export async function avisarLojaNoWhatsApp(db: DB, loja: { id: number; slug: string; whatsapp: string; callmebotApiKey: string | null }, pedidoId: number) {
  if (!loja.callmebotApiKey) return;
  const tarefa = () => enviarAviso(db, loja, pedidoId).catch((e) => console.error("Aviso no WhatsApp:", (e as Error).message));
  try {
    after(tarefa);
  } catch {
    await tarefa();
  }
}
