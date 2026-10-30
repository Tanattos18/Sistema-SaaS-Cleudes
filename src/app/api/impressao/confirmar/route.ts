import { getDb } from "@/db";
import { confirmarImpressao, confirmarTeste, lojaDaChave } from "@/lib/impressao";

/** O programa avisa que imprimiu: o pedido (ou a página de teste) não volta na próxima consulta. */
export async function POST(request: Request) {
  const db = await getDb();
  const loja = await lojaDaChave(db, request.headers.get("authorization"));
  if (!loja) return Response.json({ erro: "Chave de impressão inválida." }, { status: 401 });
  const corpo = (await request.json().catch(() => null)) as { id?: unknown; teste?: unknown } | null;
  if (corpo?.teste === true) {
    await confirmarTeste(db, loja.id);
    return Response.json({ ok: true });
  }
  const id = Number(corpo?.id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ erro: "Pedido inválido." }, { status: 400 });
  const ok = await confirmarImpressao(db, loja.id, id);
  return Response.json({ ok });
}
