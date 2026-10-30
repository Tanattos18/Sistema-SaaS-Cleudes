import { inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/db";
import { pedidoComItens, paraMensagem } from "@/lib/consultas";
import { ROTULO_PAGAMENTO, ROTULO_STATUS } from "@/lib/dominio";
import { moeda } from "@/lib/formato";
import { horariosDaLoja, lojaPorSlug, urlDoSite } from "@/lib/loja";
import { linhaItem, linkWhatsApp, mensagemPedido } from "@/lib/whatsapp";
import { IconeCheck, IconeLocal, IconeWhatsApp } from "@/components/icones";
import { AutoAtualizar } from "@/components/auto-atualizar";
import { confirmarPagamento } from "@/lib/mercadopago";
import { Logo, RodapeLoja } from "../../marca";
import { BotaoPagar } from "./pagar";

export const metadata = { title: "Seu pedido" };

const PASSOS = ["novo", "em_separacao", "saiu_entrega", "entregue"] as const;

export default async function PedidoPage({ params, searchParams }: PageProps<"/[loja]/pedido/[codigo]">) {
  const { loja: slug, codigo } = await params;
  const volta = await searchParams;
  const db = await getDb();
  const loja = await lojaPorSlug(db, slug);
  let pedido = loja && (await pedidoComItens(db, { codigo }));
  if (!loja || !pedido || pedido.lojaId !== loja.id) notFound();

  // Voltando do Mercado Pago: confere o pagamento na hora, sem esperar a notificação.
  const pagamentoId = volta.payment_id ?? volta.collection_id;
  if (pedido.status === "aguardando_pagamento" && typeof pagamentoId === "string" && /^\d+$/.test(pagamentoId)) {
    try {
      const r = await confirmarPagamento(db, loja, pagamentoId);
      if (r.decisao === "aprovar") pedido = (await pedidoComItens(db, { codigo }))!;
    } catch (e) {
      console.error("Conferindo pagamento na volta do Mercado Pago:", (e as Error).message);
    }
  }
  const statusVolta = typeof volta.status === "string" ? volta.status : typeof volta.collection_status === "string" ? volta.collection_status : null;

  const [fotos, horarios] = await Promise.all([
    db
      .select({ id: schema.produtos.id, imagemUrl: schema.produtos.imagemUrl })
      .from(schema.produtos)
      .where(inArray(schema.produtos.id, pedido.itens.map((i) => i.produtoId))),
    horariosDaLoja(db, loja.id),
  ]);
  const foto = new Map(fotos.map((f) => [f.id, f.imagemUrl]));

  const link = `${urlDoSite()}/${loja.slug}/pedido/${pedido.codigo}`;
  const whatsapp = linkWhatsApp(loja.whatsapp, mensagemPedido(paraMensagem(pedido), link));
  const passo = PASSOS.indexOf(pedido.status as (typeof PASSOS)[number]);

  return (
    <div className="min-h-screen bg-[#f4f5f9]">
      <header className="bg-marca-amarelo shadow-md">
        <div className="mx-auto max-w-3xl px-4 py-2.5"><Logo nome={loja.nome} slug={loja.slug} compacto /></div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {pedido.status === "cancelado" ? (
          <div className="rounded-3xl bg-marca-vermelho p-6 text-white shadow-lg">
            <p className="font-titulos text-3xl font-extrabold">Pedido nº {pedido.numero} cancelado</p>
            {pedido.canceladoMotivo && <p className="mt-1">{pedido.canceladoMotivo}</p>}
          </div>
        ) : pedido.status === "aguardando_pagamento" ? (
          <div className="space-y-4 rounded-3xl bg-marca-amarelo p-6 text-marca-azul-escuro shadow-lg">
            <AutoAtualizar segundos={8} />
            <div>
              <p className="font-titulos text-3xl font-extrabold">Pedido nº {pedido.numero}</p>
              {statusVolta === "rejected" || statusVolta === "failure" ? (
                <p className="mt-1 font-semibold">O pagamento não foi aprovado. Tente de novo, com outro cartão ou com Pix.</p>
              ) : statusVolta === "pending" || statusVolta === "in_process" ? (
                <p className="mt-1 font-semibold">Pagamento em análise. Assim que for aprovado, seu pedido vai para a separação (esta página atualiza sozinha).</p>
              ) : (
                <p className="mt-1 font-semibold">Falta pagar: {ROTULO_PAGAMENTO[pedido.formaPagamento]} de {moeda(pedido.total)}. Seu pedido só vai para a separação depois do pagamento.</p>
              )}
            </div>
            <BotaoPagar slug={loja.slug} codigo={pedido.codigo} rotulo={`Pagar ${moeda(pedido.total)} agora`} />
            <p className="text-xs">Pagamento seguro pelo Mercado Pago. Já pagou? Esta página atualiza sozinha em instantes.</p>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-3xl bg-marca-azul p-6 text-white shadow-lg">
            <div className="absolute -top-12 -right-12 size-44 rounded-full bg-white/10" aria-hidden />
            <div className="relative">
              <span className="grid size-14 place-items-center rounded-full bg-green-500 shadow-lg ring-4 ring-white/30"><IconeCheck width={30} height={30} /></span>
              <p className="mt-3 font-titulos text-3xl leading-tight font-extrabold">Pedido nº {pedido.numero} recebido!</p>
              <p className="text-blue-100">Situação: <strong className="text-marca-amarelo">{ROTULO_STATUS[pedido.status]}</strong></p>
              <ol className="mt-5 grid grid-cols-4 gap-1.5">
                {PASSOS.map((s, i) => (
                  <li key={s} className="text-center">
                    <span className={`block h-2 rounded-full ${i <= passo ? "bg-marca-amarelo" : "bg-white/20"}`} />
                    <span className={`mt-1.5 block text-[11px] leading-tight font-semibold sm:text-xs ${i <= passo ? "text-white" : "text-blue-200"}`}>{ROTULO_STATUS[s]}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {pedido.status === "novo" && (
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="font-bold text-gray-900">Envie também pelo WhatsApp para falar direto com a loja:</p>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 text-lg font-bold text-white shadow-lg hover:bg-green-700">
              <IconeWhatsApp width={24} height={24} /> Enviar pedido no WhatsApp
            </a>
            <p className="mt-2 text-center text-xs text-gray-500">Guarde este link para acompanhar a entrega.</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h2 className="mb-2 font-titulos text-xl font-extrabold text-marca-azul-escuro">Itens</h2>
            <ul className="divide-y">
              {pedido.itens.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-marca-amarelo-claro">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {foto.get(i.produtoId) && <img src={foto.get(i.produtoId)!} alt="" width={48} height={48} className="size-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <p>{linhaItem(i)}</p>
                    {i.observacao && <p className="text-xs text-gray-500">obs.: {i.observacao}</p>}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{moeda(pedido.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Entrega</span><span>{pedido.taxaEntrega === 0 ? "grátis" : moeda(pedido.taxaEntrega)}</span></div>
              <div className="flex items-baseline justify-between"><span className="font-bold">Total</span><span className="font-titulos text-2xl font-extrabold text-marca-azul-escuro">{moeda(pedido.total)}</span></div>
            </div>
          </section>

          <section className="space-y-3 rounded-3xl bg-white p-5 text-sm shadow-sm ring-1 ring-black/5">
            <div>
              <p className="text-xs font-bold tracking-wide text-gray-400 uppercase">Pagamento</p>
              <p className="font-semibold">{ROTULO_PAGAMENTO[pedido.formaPagamento]}{pedido.pagoEm ? " (pago)" : ""}</p>
              {pedido.formaPagamento === "entrega_dinheiro" && <p className="text-gray-600">{pedido.trocoPara ? `Troco para ${moeda(pedido.trocoPara)}` : "Sem troco"}</p>}
            </div>
            <div>
              <p className="text-xs font-bold tracking-wide text-gray-400 uppercase">Entrega</p>
              <p className="flex gap-1.5"><IconeLocal width={16} height={16} className="mt-0.5 shrink-0 text-marca-azul" />{pedido.rua}, {pedido.numeroEndereco}{pedido.complemento ? ` - ${pedido.complemento}` : ""} - {pedido.bairro}</p>
            </div>
            {pedido.observacoes && (
              <div>
                <p className="text-xs font-bold tracking-wide text-gray-400 uppercase">Observações</p>
                <p>{pedido.observacoes}</p>
              </div>
            )}
          </section>
        </div>
      </main>

      <RodapeLoja loja={{ nome: loja.nome, slug: loja.slug, endereco: loja.endereco, whatsapp: loja.whatsapp, horarios }} />
    </div>
  );
}
