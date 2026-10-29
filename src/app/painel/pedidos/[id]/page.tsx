import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { pedidoComItens } from "@/lib/consultas";
import { PROXIMOS_STATUS, ROTULO_PAGAMENTO, ROTULO_STATUS, telefoneBR } from "@/lib/dominio";
import { moeda } from "@/lib/formato";
import { linhaItem, linkWhatsApp } from "@/lib/whatsapp";
import { Cabecalho, Selo } from "@/components/ui";
import { mudarStatus, reimprimir } from "../../actions";

export const metadata = { title: "Pedido — Painel" };

const ACAO: Partial<Record<string, string>> = {
  em_separacao: "Iniciar separação",
  saiu_entrega: "Saiu para entrega",
  entregue: "Marcar como entregue",
};

export default async function PedidoPainelPage({ params }: PageProps<"/painel/pedidos/[id]">) {
  const usuario = await exigirUsuario();
  const { id } = await params;
  const db = await getDb();
  const p = await pedidoComItens(db, { id: Number(id) || 0 });
  if (!p || p.lojaId !== usuario.lojaId) notFound();
  const proximos = PROXIMOS_STATUS[p.status];
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

  return (
    <div className="max-w-3xl">
      <Link href="/painel" className="link text-sm">← Pedidos</Link>
      <Cabecalho titulo={`Pedido #${p.numero}`} descricao={hora.format(p.criadoEm)} acoes={<Selo tipo={p.status}>{ROTULO_STATUS[p.status]}</Selo>} />

      {proximos.length > 0 && (
        <div className="cartao mb-4 flex flex-wrap items-end gap-3">
          {proximos.filter((s) => s !== "cancelado").map((s) => (
            <form key={s} action={mudarStatus}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="status" value={s} />
              <button className="botao">{ACAO[s] ?? ROTULO_STATUS[s]}</button>
            </form>
          ))}
          <form action={mudarStatus} className="ml-auto flex items-end gap-2">
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="status" value="cancelado" />
            <input name="motivo" className="campo w-48" placeholder="Motivo do cancelamento" maxLength={200} />
            <button className="botao-perigo">Cancelar</button>
          </form>
        </div>
      )}

      {p.status !== "aguardando_pagamento" && p.status !== "cancelado" && (
        <div className="cartao mb-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium">
            {p.impressoEm ? `🖨️ Impresso às ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", timeStyle: "short" }).format(p.impressoEm)}` : "🖨️ Aguardando impressão"}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {p.impressoEm && (
              <form action={reimprimir}>
                <input type="hidden" name="id" value={p.id} />
                <button className="botao-sec">Reimprimir na impressora</button>
              </form>
            )}
            <a href={`/painel/pedidos/${p.id}/comprovante`} target="_blank" rel="noopener" className="botao-sec">Imprimir pelo navegador</a>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="cartao space-y-1 text-sm">
          <h2 className="mb-1 font-semibold">Cliente</h2>
          <p>{p.clienteNome}</p>
          <p>
            <a className="link" href={linkWhatsApp(p.clienteTelefone, `Olá, ${p.clienteNome}! Sobre o seu pedido nº ${p.numero}:`)} target="_blank" rel="noopener noreferrer">
              {telefoneBR(p.clienteTelefone)} (WhatsApp)
            </a>
          </p>
          <p>{p.rua}, {p.numeroEndereco}{p.complemento ? ` - ${p.complemento}` : ""}</p>
          <p>{p.bairro}</p>
          {p.referencia && <p className="text-gray-600">Ref.: {p.referencia}</p>}
        </section>
        <section className="cartao space-y-1 text-sm">
          <h2 className="mb-1 font-semibold">Pagamento</h2>
          <p>{ROTULO_PAGAMENTO[p.formaPagamento]}</p>
          <p>{p.pagoEm ? <span className="text-green-700">Pago</span> : p.formaPagamento.startsWith("online_") ? "Aguardando confirmação" : "Receber na entrega"}</p>
          {p.formaPagamento === "entrega_dinheiro" && <p className="font-medium">{p.trocoPara ? `Levar troco para ${moeda(p.trocoPara)} (${moeda(p.trocoPara - p.total)})` : "Sem troco"}</p>}
          {p.observacoes && <p className="pt-2"><strong>Obs.:</strong> {p.observacoes}</p>}
          {p.canceladoMotivo && <p className="text-red-700">Cancelado: {p.canceladoMotivo}</p>}
        </section>
      </div>

      <section className="cartao mt-4">
        <h2 className="mb-2 font-semibold">Itens</h2>
        <ul className="divide-y text-sm">
          {p.itens.map((i) => (
            <li key={i.id} className="py-1.5">
              {linhaItem(i)}
              {i.observacao && <span className="block text-xs text-gray-500">obs.: {i.observacao}</span>}
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{moeda(p.subtotal)}</span></div>
          <div className="flex justify-between"><span>Entrega</span><span>{moeda(p.taxaEntrega)}</span></div>
          <div className="flex justify-between font-bold"><span>Total</span><span>{moeda(p.total)}</span></div>
        </div>
      </section>
    </div>
  );
}
