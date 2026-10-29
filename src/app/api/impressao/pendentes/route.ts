import { getDb } from "@/db";
import { lojaDaChave, pedidosParaImprimir } from "@/lib/impressao";

/** Consultado pelo programa de impressão do PC da loja a cada poucos segundos. */
export async function GET(request: Request) {
  const db = await getDb();
  const loja = await lojaDaChave(db, request.headers.get("authorization"));
  if (!loja) return Response.json({ erro: "Chave de impressão inválida." }, { status: 401 });
  const pedidos = await pedidosParaImprimir(db, loja);
  return Response.json({ loja: loja.nome, pedidos }, { headers: { "Cache-Control": "no-store" } });
}
