import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { usuarioAutorizado } from "@/lib/auth";
import { urlDoSite } from "@/lib/loja";

/** config.json do programa de impressão, já com o endereço do sistema e a chave da loja. Só administrador. */
export async function GET() {
  const u = await usuarioAutorizado();
  if (!u || u.perfil !== "admin") return new Response("Apenas o administrador da loja.", { status: 403 });
  const db = await getDb();
  const [loja] = await db.select({ token: schema.lojas.tokenImpressao }).from(schema.lojas).where(eq(schema.lojas.id, u.lojaId));
  const config = {
    sistema: urlDoSite(),
    chave: loja.token,
    impressora: {
      tipo: "windows",
      nome: "EPSON TM-T88V Receipt",
      ip: "192.168.0.100",
      porta: 9100,
    },
    copias: 1,
    intervaloSegundos: 5,
  };
  return new Response(JSON.stringify(config, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="config.json"',
      "Cache-Control": "no-store",
    },
  });
}
