import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { pedidoComItens, paraMensagem } from "@/lib/consultas";
import { ROTULO_PAGAMENTO, ROTULO_STATUS } from "@/lib/dominio";
import { moeda } from "@/lib/formato";
import { lojaPorSlug, urlDoSite } from "@/lib/loja";
import { linhaItem, linkWhatsApp, mensagemPedido } from "@/lib/whatsapp";

export const metadata = { title: "Seu pedido" };

const PASSOS = ["novo", "em_separacao", "saiu_entrega", "entregue"] as const;

export default async function PedidoPage({ params }: PageProps<"/[loja]/pedido/[codigo]">) {
  const { loja: slug, codigo } = await params;
  const db = await getDb();
  const loja = await lojaPorSlug(db, slug);
  const pedido = loja && (await pedidoComItens(db, { codigo }));
  if (!loja || !pedido || pedido.lojaId !== loja.id) notFound();

  const link = `${urlDoSite()}/${loja.slug}/pedido/${pedido.codigo}`;
  const whatsapp = linkWhatsApp(loja.whatsapp, mensagemPedido(paraMensagem(pedido), link));
  const passo = PASSOS.indexOf(pedido.status as (typeof PASSOS)[number]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-yellow-400 text-blue-950">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <Link href={`/${loja.slug}`} className="text-sm underline">← {loja.nome}</Link>
          <h1 className="mt-1 text-2xl font-extrabold">Pedido nº {pedido.numero}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        {pedido.status === "cancelado" ? (
          <div className="cartao border-red-200 bg-red-50 text-red-800">
            <p className="font-semibold">Pedido cancelado</p>
            {pedido.canceladoMotivo && <p className="text-sm">{pedido.canceladoMotivo}</p>}
          </div>
        ) : pedido.status === "aguardando_pagamento" ? (
          <div className="cartao border-yellow-300 bg-yellow-50 text-yellow-900">
            <p className="font-semibold">Aguardando a confirmação do pagamento</p>
            <p className="text-sm">Assim que o pagamento for aprovado, seu pedido vai para separação.</p>
          </div>
        ) : (
          <div className="cartao">
            <p className="text-sm text-gray-500">Situação</p>
            <p className="text-lg font-bold text-green-700">{ROTULO_STATUS[pedido.status]}</p>
            <ol className="mt-3 grid grid-cols-4 gap-1 text-center text-[11px]">
              {PASSOS.map((s, i) => (
                <li key={s} className={`rounded px-1 py-1.5 ${i <= passo ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500"}`}>{ROTULO_STATUS[s]}</li>
              ))}
            </ol>
          </div>
        )}

        {pedido.status === "novo" && (
          <div className="cartao space-y-2 border-green-200 bg-green-50">
            <p className="font-semibold text-green-900">Pedido recebido! Envie também pelo WhatsApp para falar com a loja:</p>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center rounded-xl bg-green-600 py-3 font-semibold text-white hover:bg-green-700">
              Enviar pedido no WhatsApp
            </a>
            <p className="text-xs text-green-900">Guarde este link para acompanhar a entrega.</p>
          </div>
        )}

        <section className="cartao">
          <h2 className="mb-2 font-semibold text-blue-950">Itens</h2>
          <ul className="space-y-1 text-sm">
            {pedido.itens.map((i) => (
              <li key={i.id}>
                {linhaItem(i)}
                {i.observacao && <span className="block text-xs text-gray-500">obs.: {i.observacao}</span>}
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{moeda(pedido.subtotal)}</span></div>
            <div className="flex justify-between"><span>Entrega</span><span>{pedido.taxaEntrega === 0 ? "grátis" : moeda(pedido.taxaEntrega)}</span></div>
            <div className="flex justify-between text-base font-bold"><span>Total</span><span>{moeda(pedido.total)}</span></div>
          </div>
        </section>

        <section className="cartao space-y-1 text-sm">
          <p><strong>Pagamento:</strong> {ROTULO_PAGAMENTO[pedido.formaPagamento]}{pedido.pagoEm ? " (pago)" : ""}</p>
          {pedido.formaPagamento === "entrega_dinheiro" && <p>{pedido.trocoPara ? `Troco para ${moeda(pedido.trocoPara)}` : "Sem troco"}</p>}
          <p><strong>Entrega:</strong> {pedido.rua}, {pedido.numeroEndereco}{pedido.complemento ? ` - ${pedido.complemento}` : ""} - {pedido.bairro}</p>
          {pedido.observacoes && <p><strong>Observações:</strong> {pedido.observacoes}</p>}
        </section>
      </main>
    </div>
  );
}
