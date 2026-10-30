import { getDb } from "@/db";
import { lojaDaChave, pedidosParaImprimir } from "@/lib/impressao";
import { sincronizarPendentes } from "@/lib/mercadopago";

/** Consultado pelo programa de impressão do PC da loja a cada poucos segundos. */
export async function GET(request: Request) {
  const db = await getDb();
  const loja = await lojaDaChave(db, request.headers.get("authorization"));
  if (!loja) return Response.json({ erro: "Chave de impressão inválida." }, { status: 401 });
  // Confere no Mercado Pago os pedidos que aguardam pagamento: pago e sem aviso, imprime assim mesmo.
  await sincronizarPendentes(db, loja).catch((e) => console.error("Sincronizando pagamentos:", (e as Error).message));
  const pedidos = await pedidosParaImprimir(db, loja);
  return Response.json({ loja: loja.nome, pedidos }, { headers: { "Cache-Control": "no-store" } });
}
