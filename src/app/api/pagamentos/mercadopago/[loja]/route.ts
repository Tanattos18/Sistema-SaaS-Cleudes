import { getDb } from "@/db";
import { lojaPorSlug } from "@/lib/loja";
import { confirmarPagamento } from "@/lib/mercadopago";

/**
 * Notificação do Mercado Pago (webhook) de cada loja. Só traz o número do pagamento: os dados são
 * sempre consultados na API com a credencial da loja, então uma chamada falsa não aprova pedido.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/pagamentos/mercadopago/[loja]">) {
  const { loja: slug } = await params;
  const url = new URL(request.url);
  const corpo = (await request.json().catch(() => null)) as { type?: string; action?: string; data?: { id?: string | number } } | null;
  const tipo = corpo?.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const id = corpo?.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");
  // Outros avisos (pedido do Mercado Livre, assinatura, teste do painel): só confirma o recebimento.
  if (tipo !== "payment" || !id) return Response.json({ ok: true });

  const db = await getDb();
  const loja = await lojaPorSlug(db, slug);
  if (!loja) return Response.json({ ok: true });
  try {
    const r = await confirmarPagamento(db, loja, id);
    return Response.json({ ok: true, decisao: r.decisao });
  } catch (e) {
    console.error("Notificação Mercado Pago:", (e as Error).message);
    // Erro temporário (API fora do ar): o Mercado Pago tenta de novo mais tarde.
    return Response.json({ ok: false }, { status: 500 });
  }
}
