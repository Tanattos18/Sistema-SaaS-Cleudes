"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FormaPagamento } from "@/db/schema";
import { ROTULO_PAGAMENTO, pagamentoOnline } from "@/lib/dominio";
import { moeda } from "@/lib/formato";
import { calcularPedido, type ItemCarrinho } from "@/lib/pedido";
import { fecharPedido } from "./actions";
import { CLIENTE_VAZIO, useGuardado, type DadosCliente } from "./carrinho";
import type { DadosVitrine, ProdutoVitrine } from "./vitrine";

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
    <label key={f} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${forma === f ? "border-blue-900 bg-blue-50" : "border-gray-300 bg-white"}`}>
      <input type="radio" name="pagamento" checked={forma === f} onChange={() => setForma(f)} />
      {ROTULO_PAGAMENTO[f]}
    </label>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-yellow-400 text-blue-950">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <button type="button" onClick={voltar} className="text-sm underline">← Voltar</button>
          <h1 className="text-lg font-bold">Entrega e pagamento</h1>
        </div>
      </header>

      <form onSubmit={enviar} className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        <section className="cartao space-y-3">
          <h2 className="font-semibold text-blue-950">Seus dados</h2>
          <label className="block"><span className="rotulo">Nome *</span><input className="campo" autoComplete="name" required minLength={2} maxLength={80} {...campo("nome")} /></label>
          <label className="block"><span className="rotulo">Telefone / WhatsApp *</span><input className="campo" type="tel" inputMode="tel" autoComplete="tel" placeholder="(62) 90000-0000" required {...campo("telefone")} /></label>
        </section>

        <section className="cartao space-y-3">
          <h2 className="font-semibold text-blue-950">Endereço de entrega</h2>
          <div className="grid grid-cols-3 gap-3">
            <label className="col-span-2 block"><span className="rotulo">Rua *</span><input className="campo" autoComplete="address-line1" required maxLength={120} {...campo("rua")} /></label>
            <label className="block"><span className="rotulo">Número *</span><input className="campo" required maxLength={20} placeholder="ou S/N" {...campo("numero")} /></label>
          </div>
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
          <label className="block"><span className="rotulo">Ponto de referência</span><input className="campo" maxLength={150} {...campo("referencia")} /></label>
        </section>

        <section className="cartao space-y-3">
          <h2 className="font-semibold text-blue-950">Pagamento</h2>
          {online.length > 0 && (
            <div className="space-y-2">
              <p className="rotulo">Pagar agora, pelo site</p>
              {online.map(opcao)}
            </div>
          )}
          {naEntrega.length > 0 && (
            <div className="space-y-2">
              <p className="rotulo">Pagar na entrega</p>
              {naEntrega.map(opcao)}
            </div>
          )}
          {forma === "entrega_dinheiro" && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={precisaTroco} onChange={(e) => setPrecisaTroco(e.target.checked)} />
                Preciso de troco
              </label>
              {precisaTroco && (
                <label className="mt-2 block"><span className="rotulo">Troco para quanto?</span><input className="campo" inputMode="decimal" placeholder="ex.: 100,00" value={troco} onChange={(e) => setTroco(e.target.value)} /></label>
              )}
            </div>
          )}
        </section>

        <section className="cartao space-y-2">
          <label className="block"><span className="rotulo">Observações do pedido</span><textarea className="campo" rows={2} maxLength={500} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="ex.: tocar a campainha, entregar no portão" /></label>
        </section>

        <section className="cartao space-y-1 text-sm">
          {resumo && (
            <>
              <div className="flex justify-between"><span>Subtotal</span><span>{moeda(resumo.subtotal)}</span></div>
              <div className="flex justify-between">
                <span>Entrega</span>
                <span>{semBairro ? "escolha o bairro" : resumo.taxaEntrega === 0 ? "grátis" : moeda(resumo.taxaEntrega)}</span>
              </div>
              <div className="flex justify-between text-base font-bold"><span>Total</span><span>{moeda(resumo.total)}</span></div>
              {itens.some((i) => i.valor != null) && <p className="text-xs text-gray-500">Itens pesados na hora: quantidade aproximada ao valor escolhido.</p>}
            </>
          )}
          {typeof calc === "string" && !semBairro && <p className="text-red-700">{calc}</p>}
        </section>

        {erro && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">{erro}</p>}
        <button type="submit" disabled={enviando || typeof calc === "string"} className="w-full rounded-xl bg-blue-900 py-3.5 font-semibold text-white disabled:opacity-40">
          {enviando ? "Enviando…" : forma && pagamentoOnline(forma) ? "Ir para o pagamento" : "Confirmar pedido"}
        </button>
      </form>
    </div>
  );
}
