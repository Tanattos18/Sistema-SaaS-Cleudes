import { getDb } from "@/db";
import { lojaDaChave, registrarImpressoras } from "@/lib/impressao";

/** O programa manda a lista de impressoras instaladas no Windows do balcão, para o painel oferecer na escolha. */
export async function POST(request: Request) {
  const db = await getDb();
  const loja = await lojaDaChave(db, request.headers.get("authorization"));
  if (!loja) return Response.json({ erro: "Chave de impressão inválida." }, { status: 401 });
  const corpo = (await request.json().catch(() => null)) as { computador?: unknown; impressoras?: unknown } | null;
  const nomes = Array.isArray(corpo?.impressoras) ? corpo.impressoras.filter((n): n is string => typeof n === "string") : [];
  await registrarImpressoras(db, loja.id, typeof corpo?.computador === "string" ? corpo.computador : "", nomes);
  return Response.json({ ok: true });
}
