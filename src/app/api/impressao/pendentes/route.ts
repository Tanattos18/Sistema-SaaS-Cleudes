import { getDb } from "@/db";
import { impressoraDoPainel, lojaDaChave, pedidosParaImprimir } from "@/lib/impressao";
import { sincronizarPendentes } from "@/lib/mercadopago";

/**
 * Consultado pelo programa de impressão do PC da loja a cada poucos segundos. Além dos pedidos, devolve a
 * impressora escolhida no painel e se há página de teste pedida.
 */
export async function GET(request: Request) {
  const db = await getDb();
  const loja = await lojaDaChave(db, request.headers.get("authorization"));
  if (!loja) return Response.json({ erro: "Chave de impressão inválida." }, { status: 401 });
  // Confere no Mercado Pago os pedidos que aguardam pagamento: pago e sem aviso, imprime assim mesmo.
  await sincronizarPendentes(db, loja).catch((e) => console.error("Sincronizando pagamentos:", (e as Error).message));
  const pedidos = await pedidosParaImprimir(db, loja);
  return Response.json(
    { loja: loja.nome, pedidos, impressora: impressoraDoPainel(loja), teste: !!loja.impressaoTestePedidaEm },
    { headers: { "Cache-Control": "no-store" } },
  );
}
