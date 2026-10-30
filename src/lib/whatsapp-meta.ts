/**
 * WhatsApp oficial (WhatsApp Cloud API da Meta). A Akylla tem um número oficial que avisa todas as lojas:
 * as credenciais ficam no servidor (variáveis de ambiente), e cada loja só liga o aviso no painel.
 * Mensagem enviada por modelo aprovado pela Meta (categoria "utilidade"), com os dados do pedido.
 *
 *   WHATSAPP_TOKEN            token permanente (usuário do sistema no Meta Business)
 *   WHATSAPP_PHONE_NUMBER_ID  identificação do número que envia
 *   WHATSAPP_MODELO           nome do modelo aprovado (padrão: novo_pedido)
 *   WHATSAPP_IDIOMA           idioma do modelo (padrão: pt_BR)
 */

const API = () => (process.env.WHATSAPP_API ?? "https://graph.facebook.com").replace(/\/$/, "");
const VERSAO = () => process.env.WHATSAPP_API_VERSAO ?? "v23.0";

export function whatsappConfigurado(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export type DadosAviso = { numero: number; loja: string; total: string; pagamento: string; cliente: string; bairro: string; link: string };

/** A Meta não aceita quebra de linha, tabulação nem mais de 4 espaços seguidos dentro de uma variável. */
export function limparParametro(texto: string): string {
  return texto.replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim().slice(0, 300) || "-";
}

/**
 * Modelo "novo_pedido" (cadastrar na Meta exatamente com estas 7 variáveis, nesta ordem):
 *   🛒 Novo pedido nº {{1}} na {{2}}
 *   Total: {{3}} ({{4}})
 *   Cliente: {{5}}, bairro {{6}}
 *   Ver o pedido completo: {{7}}
 */
export function corpoModelo(destino: string, d: DadosAviso) {
  const parametros = [String(d.numero), d.loja, d.total, d.pagamento, d.cliente, d.bairro, d.link];
  return {
    messaging_product: "whatsapp",
    to: destino,
    type: "template",
    template: {
      name: process.env.WHATSAPP_MODELO ?? "novo_pedido",
      language: { code: process.env.WHATSAPP_IDIOMA ?? "pt_BR" },
      components: [{ type: "body", parameters: parametros.map((t) => ({ type: "text", text: limparParametro(t) })) }],
    },
  };
}

/** Envia o aviso; devolve null se deu certo ou a mensagem de erro da Meta. */
export async function enviarWhatsappOficial(destino: string, dados: DadosAviso): Promise<string | null> {
  if (!whatsappConfigurado()) return "WhatsApp oficial não configurado no servidor.";
  try {
    const r = await fetch(`${API()}/${VERSAO()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpoModelo(destino, dados)),
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) return null;
    const corpo = (await r.json().catch(() => ({}))) as { error?: { message?: string; error_data?: { details?: string } } };
    return corpo.error?.error_data?.details ?? corpo.error?.message ?? `Meta respondeu ${r.status}`;
  } catch (e) {
    return (e as Error).message;
  }
}
