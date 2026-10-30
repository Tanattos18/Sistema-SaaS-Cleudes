import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Verificação de saúde para monitoramento e diagnóstico da publicação.
 * Não mostra valores: só se as variáveis existem e o tipo de erro do banco (código), nunca a URL ou a senha.
 */
export async function GET() {
  const url = process.env.DATABASE_URL ?? "";
  const variaveis = {
    DATABASE_URL: url ? (/-pooler\./.test(url) ? "definida (pooled)" : "definida (direta)") : "faltando",
    SESSION_SECRET: process.env.SESSION_SECRET ? "definida" : "faltando",
  };
  try {
    const db = await getDb();
    const r = (await db.execute(sql`select count(*)::int as lojas from lojas`)) as unknown as { lojas: number }[];
    return Response.json({ ok: true, variaveis, banco: "conectado", lojas: r[0]?.lojas ?? 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const erro = e as { code?: string; cause?: { code?: string; message?: string }; message?: string };
    const codigo = erro.cause?.code ?? erro.code ?? null;
    // Primeira linha da mensagem, sem nada que pareça endereço ou credencial.
    const mensagem = (erro.cause?.message ?? erro.message ?? "").split("\n")[0].replace(/postgres(ql)?:\/\/\S+/g, "[url]").slice(0, 160);
    return Response.json({ ok: false, variaveis, banco: "erro", codigo, mensagem }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
