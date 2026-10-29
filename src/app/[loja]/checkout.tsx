"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import type { FormaPagamento } from "@/db/schema";
import { ROTULO_PAGAMENTO, pagamentoOnline, quilos } from "@/lib/dominio";
import { moeda } from "@/lib/formato";
import { calcularItem, calcularPedido, type ItemCarrinho } from "@/lib/pedido";
import { IconeCheck, IconeVoltar } from "@/components/icones";
import { fecharPedido } from "./actions";
import { CLIENTE_VAZIO, useGuardado, type DadosCliente } from "./carrinho";
import { Logo } from "./marca";
import type { DadosVitrine, ProdutoVitrine } from "./vitrine";

const ICONE_PAGAMENTO: Record<FormaPagamento, string> = {
  online_pix: "⚡",
  online_cartao: "💳",
  entrega_pix: "⚡",
  entrega_credito: "💳",
  entrega_debito: "💳",
  entrega_vr: "🍽️",
  entrega_dinheiro: "💵",
};

function Secao({ numero, titulo, children }: { numero: number; titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 font-titulos text-xl font-extrabold text-marca-azul-escuro">
        <span className="grid size-8 place-items-center rounded-full bg-marca-amarelo text-base">{numero}</span>
        {titulo}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Checkout({
  dados,
  itens,
  porId,
  voltar,
  concluido,
}: {
  dados: DadosVitrine;
  itens: ItemCarrinho[];
  porId: Map<number, ProdutoVitrine>;
  voltar: () => void;
  concluido: () => void;
}) {
  const { loja, regras, bairros } = dados;
  const router = useRouter();
  // Lembra os dados do cliente neste aparelho para o próximo pedido.
  const [cliente, setCliente] = useGuardado<DadosCliente>(`cliente:${loja.slug}`, CLIENTE_VAZIO);
  const [bairroId, setBairroId] = useState<number | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [forma, setForma] = useState<FormaPagamento | null>(null);
  const [precisaTroco, setPrecisaTroco] = useState(false);
  const [troco, setTroco] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, iniciar] = useTransition();

  const porBairro = regras.modoTaxa === "bairro";
  const taxaBairro = porBairro ? (bairros.find((b) => b.id === bairroId)?.taxa ?? null) : null;
  const calc = calcularPedido(itens, porId, regras, taxaBairro);
  const semBairro = porBairro && bairroId == null;
  const calcSemTaxa = semBairro ? calcularPedido(itens, porId, { ...regras, modoTaxa: "fixa", taxaFixa: 0 }, null) : null;
  const resumo = typeof calc === "string" ? (calcSemTaxa && typeof calcSemTaxa !== "string" ? calcSemTaxa : null) : calc;

  const online = regras.formasPagamento.filter(pagamentoOnline);
  const naEntrega = regras.formasPagamento.filter((f) => !pagamentoOnline(f));
  const icone = new Map(dados.categorias.map((c) => [c.id, c.icone ?? "🛒"]));

  const campo = (k: keyof DadosCliente) => ({
    value: cliente[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCliente((c) => ({ ...c, [k]: e.target.value })),
  });

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!forma) return setErro("Escolha a forma de pagamento.");
    const trocoNum = precisaTroco ? Number(troco.replace(/\./g, "").replace(",", ".")) : null;
    if (precisaTroco && !(trocoNum && trocoNum > 0)) return setErro("Informe para quanto precisa de troco.");
    iniciar(async () => {
      const r = await fecharPedido(loja.slug, {
        itens,
        cliente: { ...cliente, bairro: porBairro ? "" : cliente.bairro },
        bairroId,
        observacoes,
        formaPagamento: forma,
        trocoPara: forma === "entrega_dinheiro" ? trocoNum : null,
      });
      if ("erro" in r) return setErro(r.erro);
      concluido();
      router.push(`/${loja.slug}/pedido/${r.codigo}`);
    });
  }

  const opcao = (f: FormaPagamento) => (
    <label key={f} className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3.5 text-sm font-semibold transition ${forma === f ? "border-marca-azul bg-marca-azul-claro" : "border-gray-200 bg-white hover:border-gray-300"}`}>
      <input type="radio" name="pagamento" className="size-4 accent-marca-azul" checked={forma === f} onChange={() => setForma(f)} />
      <span className="text-lg" aria-hidden>{ICONE_PAGAMENTO[f]}</span>
      {ROTULO_PAGAMENTO[f]}
    </label>
  );

  const passos = ["Carrinho", "Entrega e pagamento", "Confirmação"];

  return (
    <div className="min-h-screen bg-[#f4f5f9]">
      <header className="sticky top-0 z-30 bg-marca-amarelo shadow-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <button type="button" onClick={voltar} className="grid size-10 shrink-0 place-items-center rounded-full bg-white/70 text-marca-azul-escuro hover:bg-white" aria-label="Voltar ao carrinho"><IconeVoltar /></button>
          <Logo nome={loja.nome} slug={loja.slug} compacto />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-5 pb-10">
        <ol className="mb-5 flex items-center gap-2 text-xs font-bold sm:text-sm">
          {passos.map((p, i) => (
            <li key={p} className="flex items-center gap-2">
              <span className={`grid size-6 place-items-center rounded-full ${i === 0 ? "bg-green-600 text-white" : i === 1 ? "bg-marca-azul text-white" : "bg-gray-200 text-gray-500"}`}>
                {i === 0 ? <IconeCheck width={14} height={14} /> : i + 1}
              </span>
              <span className={i === 1 ? "text-marca-azul-escuro" : "hidden text-gray-500 sm:inline"}>{p}</span>
              {i < passos.length - 1 && <span className="h-px w-6 bg-gray-300 sm:w-10" />}
            </li>
          ))}
        </ol>

        <form onSubmit={enviar} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <Secao numero={1} titulo="Seus dados">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="rotulo">Nome *</span><input className="campo" autoComplete="name" required minLength={2} maxLength={80} {...campo("nome")} /></label>
                <label className="block"><span className="rotulo">Telefone / WhatsApp *</span><input className="campo" type="tel" inputMode="tel" autoComplete="tel" placeholder="(62) 90000-0000" required {...campo("telefone")} /></label>
              </div>
            </Secao>

            <Secao numero={2} titulo="Endereço de entrega">
              <div className="grid grid-cols-3 gap-3">
                <label className="col-span-2 block"><span className="rotulo">Rua *</span><input className="campo" autoComplete="address-line1" required maxLength={120} {...campo("rua")} /></label>
                <label className="block"><span className="rotulo">Número *</span><input className="campo" required maxLength={20} placeholder="ou S/N" {...campo("numero")} /></label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="rotulo">Complemento</span><input className="campo" maxLength={80} placeholder="Quadra, lote, apto…" {...campo("complemento")} /></label>
                {porBairro ? (
                  <label className="block">
                    <span className="rotulo">Bairro *</span>
                    <select className="campo" required value={bairroId ?? ""} onChange={(e) => setBairroId(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Escolha o bairro…</option>
                      {bairros.map((b) => (
                        <option key={b.id} value={b.id}>{b.nome} — entrega {moeda(b.taxa)}</option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs text-gray-500">Seu bairro não está na lista? Ainda não entregamos nele.</span>
                  </label>
                ) : (
                  <label className="block"><span className="rotulo">Bairro *</span><input className="campo" required maxLength={80} {...campo("bairro")} /></label>
                )}
              </div>
              <label className="block"><span className="rotulo">Ponto de referência</span><input className="campo" maxLength={150} {...campo("referencia")} /></label>
            </Secao>

            <Secao numero={3} titulo="Pagamento">
              {online.length > 0 && (
                <div className="space-y-2">
                  <p className="rotulo">Pagar agora, pelo site</p>
                  <div className="grid gap-2 sm:grid-cols-2">{online.map(opcao)}</div>
                </div>
              )}
              {naEntrega.length > 0 && (
                <div className="space-y-2">
                  <p className="rotulo">Pagar na entrega</p>
                  <div className="grid gap-2 sm:grid-cols-2">{naEntrega.map(opcao)}</div>
                </div>
              )}
              {forma === "entrega_dinheiro" && (
                <div className="rounded-2xl bg-marca-amarelo-claro p-4 text-sm">
                  <label className="flex items-center gap-2 font-semibold">
                    <input type="checkbox" className="size-4 accent-marca-azul" checked={precisaTroco} onChange={(e) => setPrecisaTroco(e.target.checked)} />
                    Preciso de troco
                  </label>
                  {precisaTroco && (
                    <label className="mt-3 block"><span className="rotulo">Troco para quanto?</span><input className="campo" inputMode="decimal" placeholder="ex.: 100,00" value={troco} onChange={(e) => setTroco(e.target.value)} /></label>
                  )}
                </div>
              )}
              <label className="block pt-1"><span className="rotulo">Observações do pedido</span><textarea className="campo" rows={2} maxLength={500} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="ex.: tocar a campainha, entregar no portão" /></label>
            </Secao>
          </div>

          <aside className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 lg:sticky lg:top-20">
            <h2 className="border-b px-5 py-4 font-titulos text-xl font-extrabold text-marca-azul-escuro">Resumo do pedido</h2>
            <ul className="max-h-72 divide-y overflow-y-auto px-5 lg:max-h-[40vh]">
              {itens.map((i) => {
                const p = porId.get(i.produtoId)!;
                const r = calcularItem(i, p);
                return (
                  <li key={`${i.produtoId}:${i.temVasilhame ?? ""}`} className="flex items-center gap-3 py-2.5">
                    <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-marca-amarelo-claro">
                      {p.imagemUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imagemUrl} alt="" width={44} height={44} className="size-full object-cover" />
                      ) : (
                        <span className="grid size-full place-items-center text-xl">{icone.get(p.categoriaId)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate font-semibold">{p.nome}</p>
                      <p className="text-xs text-gray-500">
                        {p.unidade === "kg" && typeof r !== "string" ? `≈ ${quilos(r.quantidade)}` : `${i.quantidade}×`}
                        {i.temVasilhame === true && " · troca"}
                        {i.temVasilhame === false && " · com botijão"}
                      </p>
                    </div>
                    <span className="text-sm font-bold">{typeof r === "string" ? "—" : moeda(r.total)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="space-y-1.5 border-t bg-gray-50 px-5 py-4 text-sm">
              {resumo && (
                <>
                  <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{moeda(resumo.subtotal)}</span></div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Entrega</span>
                    <span className={resumo.taxaEntrega === 0 && !semBairro ? "font-bold text-green-700" : ""}>{semBairro ? "escolha o bairro" : resumo.taxaEntrega === 0 ? "grátis" : moeda(resumo.taxaEntrega)}</span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1"><span className="font-bold">Total</span><span className="font-titulos text-2xl font-extrabold text-marca-azul-escuro">{moeda(resumo.total)}</span></div>
                  {itens.some((i) => i.valor != null) && <p className="text-xs text-gray-500">Itens pesados na hora: quantidade aproximada ao valor escolhido.</p>}
                </>
              )}
              {typeof calc === "string" && !semBairro && <p className="text-red-700">{calc}</p>}
              {erro && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{erro}</p>}
              <button type="submit" disabled={enviando || typeof calc === "string"} className="mt-2 w-full rounded-2xl bg-marca-azul py-4 text-base font-bold text-white shadow-lg transition hover:bg-marca-azul-escuro disabled:opacity-40">
                {enviando ? "Enviando…" : forma && pagamentoOnline(forma) ? "Ir para o pagamento" : "Confirmar pedido"}
              </button>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
