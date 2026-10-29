import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { montarComprovante } from "@/lib/comprovante";
import { pedidoComItens } from "@/lib/consultas";
import { ImprimirAoAbrir } from "./imprimir";

export const metadata = { title: "Comprovante — Painel" };

/**
 * Comprovante pelo navegador, para quando o programa de impressão não estiver rodando:
 * com a térmica instalada no Windows, é só escolher ela na janela de impressão.
 */
export default async function ComprovantePage({ params }: PageProps<"/painel/pedidos/[id]/comprovante">) {
  const usuario = await exigirUsuario();
  const { id } = await params;
  const db = await getDb();
  const p = await pedidoComItens(db, { id: Number(id) || 0 });
  if (!p || p.lojaId !== usuario.lojaId) notFound();
  const [loja] = await db.select({ nome: schema.lojas.nome }).from(schema.lojas).where(eq(schema.lojas.id, usuario.lojaId));
  const linhas = montarComprovante(loja.nome, p);

  return (
    <div>
      <style>{"@page { size: 80mm auto; margin: 3mm; } @media print { body { background: #fff !important; } }"}</style>
      <ImprimirAoAbrir />
      <div className="mx-auto w-[80mm] bg-white p-3 font-mono text-[11px] leading-[1.35] text-black shadow print:w-full print:p-0 print:shadow-none">
        {linhas.map((l, i) => (
          <pre
            key={i}
            className={`m-0 whitespace-pre-wrap ${l.negrito || l.grande ? "font-bold" : ""} ${l.grande ? "text-[19px] leading-tight" : ""} ${l.centro ? "text-center" : ""}`}
          >
            {l.texto || " "}
          </pre>
        ))}
      </div>
    </div>
  );
}
