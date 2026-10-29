"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import type { StatusPedido } from "@/db/schema";
import { auditar } from "@/lib/auditoria";
import { exigirUsuario } from "@/lib/auth";
import { PROXIMOS_STATUS } from "@/lib/dominio";

export async function mudarStatus(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = Number(formData.get("id"));
  const para = String(formData.get("status")) as StatusPedido;
  const motivo = String(formData.get("motivo") ?? "").trim().slice(0, 200) || null;
  const db = await getDb();
  const [p] = await db
    .select({ status: schema.pedidos.status })
    .from(schema.pedidos)
    .where(and(eq(schema.pedidos.id, id), eq(schema.pedidos.lojaId, usuario.lojaId)));
  if (!p || !PROXIMOS_STATUS[p.status].includes(para)) return;

  await db
    .update(schema.pedidos)
    .set({ status: para, ...(para === "cancelado" ? { canceladoMotivo: motivo } : {}) })
    // A condição no status evita que dois cliques simultâneos pulem etapas.
    .where(and(eq(schema.pedidos.id, id), eq(schema.pedidos.status, p.status)));
  await auditar(db, usuario.lojaId, usuario.uid, "status", "pedido", id, { de: p.status, para, motivo });
  revalidatePath("/painel");
}

/** Volta o pedido para a fila: o programa do balcão imprime de novo em poucos segundos. */
export async function reimprimir(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = Number(formData.get("id"));
  const db = await getDb();
  await db
    .update(schema.pedidos)
    .set({ impressoEm: null })
    .where(and(eq(schema.pedidos.id, id), eq(schema.pedidos.lojaId, usuario.lojaId)));
  await auditar(db, usuario.lojaId, usuario.uid, "reimprimir", "pedido", id);
  revalidatePath(`/painel/pedidos/${id}`);
  revalidatePath("/painel");
}
