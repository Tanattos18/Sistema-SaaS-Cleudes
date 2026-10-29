"use client";

import { useMemo, useState } from "react";
import type { Horario, SituacaoLoja } from "@/lib/horario";
import { calcularItem, type ItemCarrinho, type ProdutoCatalogo, type RegrasLoja } from "@/lib/pedido";
import { VALOR_MAX_PESO, VALOR_MIN_PESO, quilos } from "@/lib/dominio";
import { centavos, moeda } from "@/lib/formato";
import { chaveItem, useGuardado } from "./carrinho";
import { Checkout } from "./checkout";

export type ProdutoVitrine = ProdutoCatalogo & {
  categoriaId: number;
  descricao: string | null;
  precoDe: number | null;
  imagemUrl: string | null;
};

export type DadosVitrine = {
  loja: { slug: string; nome: string; mensagem: string | null };
  regras: RegrasLoja;
  situacao: SituacaoLoja;
  horarios: Horario[];
  bairros: { id: number; nome: string; taxa: number }[];
  categorias: { id: number; nome: string; icone: string | null }[];
  produtos: ProdutoVitrine[];
};

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Vitrine({ dados }: { dados: DadosVitrine }) {
  const { loja, regras, situacao, categorias, produtos } = dados;
  const [itens, setItens] = useGuardado<ItemCarrinho[]>(`carrinho:${loja.slug}`, []);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState<ProdutoVitrine | null>(null);
  const [tela, setTela] = useState<"catalogo" | "carrinho" | "checkout">("catalogo");

  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);
  const icone = useMemo(() => new Map(categorias.map((c) => [c.id, c.icone ?? "🛒"])), [categorias]);

  // Itens que saíram do catálogo desde a última visita somem do carrinho.
  const validos = itens.filter((i) => porId.has(i.produtoId));
  const subtotal = centavos(
    validos.reduce((s, i) => {
      const r = calcularItem(i, porId.get(i.produtoId));
      return typeof r === "string" ? s : s + r.total;
    }, 0),
  );
  const qtdItens = validos.reduce((s, i) => s + (i.valor != null ? 1 : (i.quantidade ?? 0)), 0);

  const filtrados = useMemo(() => {
    const termo = semAcento(busca.trim());
    if (!termo) return null;
    return produtos.filter((p) => semAcento(p.nome).includes(termo));
  }, [busca, produtos]);

  function quantidadeDe(p: ProdutoVitrine) {
    return itens.filter((i) => i.produtoId === p.id).reduce((s, i) => s + (i.quantidade ?? (i.valor ? 1 : 0)), 0);
  }

  function salvarItem(novo: ItemCarrinho) {
    setItens((atual) => {
      const k = chaveItem(novo);
      const resto = atual.filter((i) => chaveItem(i) !== k);
      const qtdOk = novo.valor != null || (novo.quantidade ?? 0) > 0;
      if (!qtdOk) return resto;
      const idx = atual.findIndex((i) => chaveItem(i) === k);
      if (idx === -1) return [...resto, novo];
      const copia = [...atual];
      copia[idx] = novo;
      return copia;
    });
  }

  function somar(p: ProdutoVitrine, delta: number) {
    const atual = itens.find((i) => chaveItem(i) === chaveItem({ produtoId: p.id }));
    salvarItem({ ...atual, produtoId: p.id, quantidade: Math.min(99, Math.max(0, (atual?.quantidade ?? 0) + delta)) });
  }

  function clicarProduto(p: ProdutoVitrine) {
    if (p.unidade === "kg" || p.precoVasilhame != null) setModal(p);
    else somar(p, 1);
  }

  const cartaoProduto = (p: ProdutoVitrine) => {
    const qtd = quantidadeDe(p);
    const simples = p.unidade === "un" && p.precoVasilhame == null;
    return (
      <li key={p.id} className={`flex flex-col rounded-xl border bg-white p-3 shadow-sm ${p.disponivel ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
        <div className="mb-2 flex h-20 items-center justify-center rounded-lg bg-yellow-50 text-4xl">
          {p.imagemUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imagemUrl} alt="" className="h-full w-full rounded-lg object-cover" />
          ) : (
            <span aria-hidden>{icone.get(p.categoriaId)}</span>
          )}
        </div>
        <p className="line-clamp-2 min-h-10 text-sm font-medium text-gray-900">{p.nome}</p>
        <div className="mt-1">
          {p.precoDe != null && <span className="mr-1 text-xs text-gray-400 line-through">{moeda(p.precoDe)}</span>}
          <span className={`font-semibold ${p.precoDe != null ? "text-red-600" : "text-blue-900"}`}>{moeda(p.preco)}</span>
          {p.unidade === "kg" && <span className="text-xs text-gray-500"> /kg</span>}
          {p.precoVasilhame != null && <span className="block text-[11px] text-gray-500">troca do vasilhame</span>}
        </div>
        <div className="mt-auto pt-2">
          {!p.disponivel ? (
            <p className="text-center text-xs font-medium text-gray-500">Indisponível</p>
          ) : simples && qtd > 0 ? (
            <div className="flex items-center justify-between rounded-lg bg-blue-900 text-white">
              <button type="button" className="px-3 py-1.5 text-lg" onClick={() => somar(p, -1)} aria-label={`Tirar um ${p.nome}`}>−</button>
              <span className="text-sm font-semibold">{qtd}</span>
              <button type="button" className="px-3 py-1.5 text-lg" onClick={() => somar(p, 1)} aria-label={`Mais um ${p.nome}`}>+</button>
            </div>
          ) : (
            <button type="button" onClick={() => clicarProduto(p)} className="w-full rounded-lg bg-yellow-400 py-1.5 text-sm font-semibold text-blue-950 hover:bg-yellow-300">
              {qtd > 0 ? `No carrinho (${qtd}) · alterar` : "Adicionar"}
            </button>
          )}
        </div>
      </li>
    );
  };

  if (tela === "checkout") {
    return (
      <Checkout
        dados={dados}
        itens={validos}
        porId={porId}
        voltar={() => setTela("carrinho")}
        concluido={() => setItens([])}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="bg-yellow-400 text-blue-950">
        <div className="mx-auto max-w-5xl px-4 pt-5 pb-4">
          <h1 className="text-2xl font-extrabold tracking-tight">{loja.nome}</h1>
          {loja.mensagem && <p className="text-sm">{loja.mensagem}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className={`rounded-full px-2 py-0.5 font-semibold ${situacao.aberta ? "bg-green-700 text-white" : "bg-red-700 text-white"}`}>
              {situacao.mensagem}
            </span>
            {regras.pedidoMinimo > 0 && <span>Pedido mínimo {moeda(regras.pedidoMinimo)}</span>}
            {regras.freteGratisAcima != null && <span>Frete grátis acima de {moeda(regras.freteGratisAcima)}</span>}
          </div>
          <details className="mt-1 text-xs">
            <summary className="cursor-pointer underline">Horários</summary>
            <ul className="mt-1 grid grid-cols-2 gap-x-4 sm:grid-cols-4">
              {DIAS.map((d, i) => {
                const h = dados.horarios.filter((x) => x.diaSemana === i);
                return <li key={d}>{d}: {h.length ? h.map((x) => `${x.abre}–${x.fecha}`).join(", ") : "fechado"}</li>;
              })}
            </ul>
          </details>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto…"
            className="mt-3 w-full rounded-lg border-0 px-4 py-2.5 text-base text-gray-900 shadow outline-none ring-blue-900 focus:ring-2"
          />
        </div>
        {!filtrados && (
          <nav className="sticky top-0 z-10 overflow-x-auto bg-blue-900">
            <div className="mx-auto flex max-w-5xl gap-1 px-2 py-2">
              {categorias.map((c) => (
                <a key={c.id} href={`#cat-${c.id}`} className="shrink-0 rounded-full px-3 py-1 text-sm text-white hover:bg-blue-800">
                  {c.icone} {c.nome}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-4">
        {filtrados ? (
          <>
            <p className="mb-3 text-sm text-gray-500">{filtrados.length} produto(s) para “{busca}”</p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{filtrados.map(cartaoProduto)}</ul>
          </>
        ) : (
          categorias.map((c) => {
            const lista = produtos.filter((p) => p.categoriaId === c.id);
            if (!lista.length) return null;
            return (
              <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-14 pb-6">
                <h2 className="mb-3 text-lg font-bold text-blue-950">{c.icone} {c.nome}</h2>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{lista.map(cartaoProduto)}</ul>
              </section>
            );
          })
        )}
      </main>

      {qtdItens > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 p-3">
          <button
            type="button"
            onClick={() => setTela("carrinho")}
            className="mx-auto flex w-full max-w-lg items-center justify-between rounded-xl bg-blue-900 px-5 py-3.5 text-white shadow-lg"
          >
            <span className="font-semibold">Ver carrinho</span>
            <span className="text-sm">{qtdItens} {qtdItens === 1 ? "item" : "itens"} · {moeda(subtotal)}</span>
          </button>
        </div>
      )}

      {modal && <ModalProduto produto={modal} itens={itens} fechar={() => setModal(null)} salvar={salvarItem} />}

      {tela === "carrinho" && (
        <Carrinho
          dados={dados}
          itens={validos}
          porId={porId}
          subtotal={subtotal}
          fechar={() => setTela("catalogo")}
          editar={(p) => setModal(p)}
          salvar={salvarItem}
          remover={(k) => setItens((a) => a.filter((i) => chaveItem(i) !== k))}
          continuar={() => setTela("checkout")}
        />
      )}
    </div>
  );
}

function ModalProduto({
  produto: p,
  itens,
  fechar,
  salvar,
}: {
  produto: ProdutoVitrine;
  itens: ItemCarrinho[];
  fechar: () => void;
  salvar: (i: ItemCarrinho) => void;
}) {
  const gas = p.precoVasilhame != null;
  const existente = itens.find((i) => i.produtoId === p.id);
  const [valor, setValor] = useState(existente?.valor ? String(existente.valor).replace(".", ",") : "");
  const [quantidade, setQuantidade] = useState(existente?.quantidade ?? 1);
  const [temVasilhame, setTemVasilhame] = useState<boolean | undefined>(existente?.temVasilhame);
  const [observacao, setObservacao] = useState(existente?.observacao ?? "");
  const [erro, setErro] = useState("");

  const valorNum = Number(valor.replace(/\./g, "").replace(",", "."));

  function confirmar() {
    const item: ItemCarrinho =
      p.unidade === "kg"
        ? { produtoId: p.id, valor: centavos(valorNum), observacao: observacao || undefined }
        : { produtoId: p.id, quantidade, temVasilhame, observacao: observacao || undefined };
    const r = calcularItem(item, p);
    if (typeof r === "string") return setErro(r);
    salvar(item);
    fechar();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={fechar}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={p.nome}>
        <h3 className="text-lg font-bold text-blue-950">{p.nome}</h3>
        <p className="text-sm text-gray-600">
          {moeda(p.preco)}
          {p.unidade === "kg" ? " o quilo" : gas ? " (troca)" : ""}
        </p>

        {p.unidade === "kg" ? (
          <div className="mt-4">
            <p className="rotulo">Quanto você quer levar (em reais)?</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {[10, 20, 30, 50].map((v) => (
                <button key={v} type="button" onClick={() => setValor(String(v))} className={`rounded-lg border px-3 py-1.5 text-sm ${valorNum === v ? "border-blue-900 bg-blue-900 text-white" : "border-gray-300"}`}>
                  {moeda(v)}
                </button>
              ))}
            </div>
            <input inputMode="decimal" className="campo" placeholder="Outro valor, ex.: 25,00" value={valor} onChange={(e) => setValor(e.target.value)} />
            {valorNum >= VALOR_MIN_PESO && valorNum <= VALOR_MAX_PESO && (
              <p className="mt-2 text-sm text-gray-700">≈ {quilos(Math.round((valorNum / p.preco) * 1000) / 1000)}</p>
            )}
            <p className="mt-2 rounded-md bg-yellow-50 p-2 text-xs text-yellow-900">
              Produto pesado na hora: a quantidade é aproximada ao valor escolhido.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {gas && (
              <fieldset className="space-y-2">
                <legend className="rotulo">Você tem o botijão vazio para troca?</legend>
                <label className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm ${temVasilhame === true ? "border-blue-900 bg-blue-50" : "border-gray-300"}`}>
                  <span><input type="radio" name="vasilhame" className="mr-2" checked={temVasilhame === true} onChange={() => setTemVasilhame(true)} />Sim, tenho o vazio (só troca)</span>
                  <strong>{moeda(p.preco)}</strong>
                </label>
                <label className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm ${temVasilhame === false ? "border-blue-900 bg-blue-50" : "border-gray-300"}`}>
                  <span><input type="radio" name="vasilhame" className="mr-2" checked={temVasilhame === false} onChange={() => setTemVasilhame(false)} />Não, quero com o botijão</span>
                  <strong>{moeda(p.preco + p.precoVasilhame!)}</strong>
                </label>
              </fieldset>
            )}
            <div className="flex items-center gap-3">
              <span className="rotulo mb-0">Quantidade</span>
              <div className="flex items-center rounded-lg border border-gray-300">
                <button type="button" className="px-3 py-1" onClick={() => setQuantidade((q) => Math.max(1, q - 1))}>−</button>
                <span className="w-8 text-center">{quantidade}</span>
                <button type="button" className="px-3 py-1" onClick={() => setQuantidade((q) => Math.min(99, q + 1))}>+</button>
              </div>
            </div>
          </div>
        )}

        <label className="mt-4 block">
          <span className="rotulo">Observação (opcional)</span>
          <input className="campo" maxLength={200} placeholder={p.unidade === "kg" ? "ex.: moer duas vezes, cortar em bifes" : "ex.: bem gelada"} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </label>

        {erro && <p className="mt-3 text-sm text-red-700">{erro}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" className="botao-sec flex-1" onClick={fechar}>Cancelar</button>
          <button type="button" className="flex-1 rounded-md bg-blue-900 px-4 py-2 text-sm font-semibold text-white" onClick={confirmar}>
            {existente ? "Atualizar" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Carrinho({
  dados,
  itens,
  porId,
  subtotal,
  fechar,
  editar,
  salvar,
  remover,
  continuar,
}: {
  dados: DadosVitrine;
  itens: ItemCarrinho[];
  porId: Map<number, ProdutoVitrine>;
  subtotal: number;
  fechar: () => void;
  editar: (p: ProdutoVitrine) => void;
  salvar: (i: ItemCarrinho) => void;
  remover: (chave: string) => void;
  continuar: () => void;
}) {
  const { regras, situacao } = dados;
  const falta = centavos(regras.pedidoMinimo - subtotal);
  const indisponivel = itens.some((i) => !porId.get(i.produtoId)?.disponivel);

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/40" onClick={fechar}>
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()} aria-label="Carrinho">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-bold text-blue-950">Seu carrinho</h2>
          <button type="button" onClick={fechar} className="text-sm text-gray-500">Fechar ✕</button>
        </div>
        <ul className="flex-1 divide-y overflow-y-auto px-5">
          {itens.map((i) => {
            const p = porId.get(i.produtoId)!;
            const r = calcularItem(i, p);
            const k = chaveItem(i);
            return (
              <li key={k} className="py-3">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.nome}</p>
                    <p className="text-xs text-gray-500">
                      {p.unidade === "kg" && typeof r !== "string" && `${moeda(i.valor ?? 0)} ≈ ${quilos(r.quantidade)}`}
                      {i.temVasilhame === true && "Troca (tem o vazio)"}
                      {i.temVasilhame === false && "Com botijão"}
                      {i.observacao && ` · ${i.observacao}`}
                    </p>
                    {typeof r === "string" && <p className="text-xs text-red-700">{r}</p>}
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{typeof r === "string" ? "—" : moeda(r.total)}</p>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs">
                  {p.unidade === "un" && (
                    <div className="flex items-center rounded border border-gray-300">
                      <button type="button" className="px-2" onClick={() => salvar({ ...i, quantidade: (i.quantidade ?? 1) - 1 })}>−</button>
                      <span className="w-6 text-center">{i.quantidade}</span>
                      <button type="button" className="px-2" onClick={() => salvar({ ...i, quantidade: Math.min(99, (i.quantidade ?? 1) + 1) })}>+</button>
                    </div>
                  )}
                  {(p.unidade === "kg" || p.precoVasilhame != null) && (
                    <button type="button" className="text-blue-800 underline" onClick={() => editar(p)}>Alterar</button>
                  )}
                  <button type="button" className="text-red-700 underline" onClick={() => remover(k)}>Remover</button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="space-y-2 border-t px-5 py-4 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><strong>{moeda(subtotal)}</strong></div>
          <p className="text-xs text-gray-500">A taxa de entrega é calculada no próximo passo.</p>
          {falta > 0 && <p className="rounded bg-yellow-50 p-2 text-xs text-yellow-900">Faltam {moeda(falta)} para o pedido mínimo de {moeda(regras.pedidoMinimo)}.</p>}
          {!situacao.aberta && <p className="rounded bg-red-50 p-2 text-xs text-red-800">{situacao.mensagem}. Não estamos recebendo pedidos agora.</p>}
          <button
            type="button"
            disabled={falta > 0 || !situacao.aberta || indisponivel || itens.length === 0}
            onClick={continuar}
            className="w-full rounded-xl bg-blue-900 py-3 font-semibold text-white disabled:opacity-40"
          >
            Continuar para entrega e pagamento
          </button>
        </div>
      </aside>
    </div>
  );
}
