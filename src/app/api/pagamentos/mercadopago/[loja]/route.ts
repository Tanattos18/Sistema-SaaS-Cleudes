import { getDb } from "@/db";
import { lojaPorSlug } from "@/lib/loja";
import { assinaturaValida, confirmarOrdem, confirmarPagamento } from "@/lib/mercadopago";
import { decifrar } from "@/lib/segredo";

/**
 * Notificação do Mercado Pago (webhook) de cada loja. Eventos: "order" (Pix gerado no site) e
 * "payment" (cartão). Com a assinatura secreta cadastrada, avisos sem assinatura válida são recusados;
 * de todo modo, os dados são sempre consultados na API com a credencial da loja, então uma chamada
 * falsa não aprova pedido.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/pagamentos/mercadopago/[loja]">) {
  const { loja: slug } = await params;
  const url = new URL(request.url);
  const corpo = (await request.json().catch(() => null)) as { type?: string; action?: string; data?: { id?: string | number } } | null;
  const tipo = corpo?.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const id = String(corpo?.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  // Outros avisos (Mercado Livre, assinaturas): só confirma o recebimento.
  if ((tipo !== "payment" && tipo !== "order") || !id) return Response.json({ ok: true });

  const db = await getDb();
  const loja = await lojaPorSlug(db, slug);
  if (!loja) return Response.json({ ok: true });
  const assinado = assinaturaValida(
    decifrar(loja.mpWebhookSecret),
    request.headers.get("x-signature"),
    request.headers.get("x-request-id"),
    url.searchParams.get("data.id") ?? id,
  );
  if (!assinado) return Response.json({ ok: false, erro: "assinatura inválida" }, { status: 401 });

  try {
    const r = tipo === "order" ? await confirmarOrdem(db, loja, id) : await confirmarPagamento(db, loja, id);
    return Response.json({ ok: true, decisao: r.decisao });
  } catch (e) {
    const msg = (e as Error).message;
    // Aviso de teste do painel do Mercado Pago (número que não existe): responde ok para ele não reenviar.
    if (/respondeu (400|404)/.test(msg)) return Response.json({ ok: true, desconhecido: true });
    console.error("Notificação Mercado Pago:", msg);
    // Erro temporário (API fora do ar): o Mercado Pago tenta de novo mais tarde.
    return Response.json({ ok: false }, { status: 500 });
  }
}
