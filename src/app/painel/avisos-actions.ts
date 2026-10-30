"use server";

import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { enviarAvisos } from "@/lib/avisos";
import { urlDoSite } from "@/lib/loja";
import { chavesVapid } from "@/lib/push";

/** Chave pública das notificações, para o navegador se inscrever. */
export async function chaveDosAvisos(): Promise<string> {
  await exigirUsuario();
  return (await chavesVapid(await getDb())).publicKey;
}

type Inscricao = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

/** Guarda (ou renova) a inscrição deste aparelho. Qualquer usuário da loja pode receber os avisos. */
export async function salvarAparelho(inscricao: Inscricao, aparelho: string): Promise<{ ok: boolean }> {
  const u = await exigirUsuario();
  const { endpoint, keys } = inscricao ?? {};
  if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint) || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") return { ok: false };
  const db = await getDb();
  const dados = { lojaId: u.lojaId, usuarioId: u.uid, p256dh: keys.p256dh, auth: keys.auth, aparelho: aparelho.slice(0, 80) || null };
  await db.insert(schema.inscricoesPush).values({ endpoint, ...dados }).onConflictDoUpdate({ target: schema.inscricoesPush.endpoint, set: dados });
  return { ok: true };
}

export async function removerAparelho(endpoint: string): Promise<void> {
  await exigirUsuario();
  const db = await getDb();
  await db.delete(schema.inscricoesPush).where(eq(schema.inscricoesPush.endpoint, endpoint));
}

/** Aviso de teste pelos canais ligados: notificação nos aparelhos e, se ligado, WhatsApp oficial. */
export async function testarAvisos(): Promise<{ aparelhos: number; whatsapp: string }> {
  const u = await exigirUsuario();
  const db = await getDb();
  const [loja] = await db
    .select({ id: schema.lojas.id, nome: schema.lojas.nome, whatsapp: schema.lojas.whatsapp, avisoWhatsappAtivo: schema.lojas.avisoWhatsappAtivo })
    .from(schema.lojas)
    .where(eq(schema.lojas.id, u.lojaId));
  return enviarAvisos(
    db,
    loja,
    { numero: 0, loja: loja.nome, total: "R$ 0,00", pagamento: "teste", cliente: "Aviso de teste", bairro: "-", link: `${urlDoSite()}/painel` },
    0,
  );
}
