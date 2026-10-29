"use client";

import { useEffect, useMemo, useState } from "react";
import type { Horario, SituacaoLoja } from "@/lib/horario";
import { calcularItem, type ItemCarrinho, type ProdutoCatalogo, type RegrasLoja } from "@/lib/pedido";
import { VALOR_MAX_PESO, VALOR_MIN_PESO, quilos } from "@/lib/dominio";
import { centavos, moeda } from "@/lib/formato";
import { IconeBusca, IconeCartao, IconeEntrega, IconeFechar, IconeLixeira, IconeMais, IconeMenos, IconeRelogio, IconeSacola } from "@/components/icones";
import { chaveItem, useGuardado } from "./carrinho";
import { Checkout } from "./checkout";
import { Logo, RodapeLoja } from "./marca";

export type ProdutoVitrine = ProdutoCatalogo & {
  categoriaId: number;
  descricao: string | null;
  precoDe: number | null;
  imagemUrl: string | null;
};

export type DadosVitrine = {
  loja: { slug: string; nome: string; mensagem: string | null; endereco: string | null; whatsapp: string };
  regras: RegrasLoja;
  situacao: SituacaoLoja;
  horarios: Horario[];
  bairros: { id: number; nome: string; taxa: number }[];
  categorias: { id: number; nome: string; icone: string | null }[];
  produtos: ProdutoVitrine[];
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const desconto = (p: ProdutoVitrine) => (p.precoDe ? Math.round((1 - p.preco / p.precoDe) * 100) : 0);

export function Vitrine({ dados }: { dados: DadosVitrine }) {
  const { loja, regras, situacao, categorias, produtos } = dados;
  const [itens, setItens] = useGuardado<ItemCarrinho[]>(`carrinho:${loja.slug}`, []);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState<ProdutoVitrine | null>(null);
  const [tela, setTela] = useState<"catalogo" | "checkout">("catalogo");
  const [gaveta, setGaveta] = useState(false);
  const [ativa, setAtiva] = useState<number | null>(categorias[0]?.id ?? null);

  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);
  const icone = useMemo(() => new Map(categorias.map((c) => [c.id, c.icone ?? "🛒"])), [categorias]);
  const porCategoria = useMemo(() => {
    const m = new Map<number, ProdutoVitrine[]>();
    for (const p of produtos) m.set(p.categoriaId, [...(m.get(p.categoriaId) ?? []), p]);
    return m;
  }, [produtos]);
  const ofertas = useMemo(() => produtos.filter((p) => p.precoDe && p.disponivel).sort((a, b) => desconto(b) - desconto(a)), [produtos]);

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

  // Destaca no menu a categoria que está na tela.
  useEffect(() => {
    if (filtrados || tela !== "catalogo") return;
    const obs = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visivel) setAtiva(Number(visivel.target.getAttribute("data-categoria")));
      },
      { rootMargin: "-140px 0px -60% 0px" },
    );
    document.querySelectorAll("[data-categoria]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [filtrados, tela]);

  // Mantém o chip da categoria ativa à vista na barra horizontal (celular e tablet).
  useEffect(() => {
    document.getElementById(`chip-${ativa}`)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [ativa]);

  useEffect(() => {
    document.body.style.overflow = gaveta || modal ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [gaveta, modal]);

  function quantidadeDe(p: ProdutoVitrine) {
    return itens.filter((i) => i.produtoId === p.id).reduce((s, i) => s + (i.quantidade ?? (i.valor ? 1 : 0)), 0);
  }

  function salvarItem(novo: ItemCarrinho) {
    setItens((atual) => {
      const k = chaveItem(novo);
      const qtdOk = novo.valor != null || (novo.quantidade ?? 0) > 0;
      if (!qtdOk) return atual.filter((i) => chaveItem(i) !== k);
      const idx = atual.findIndex((i) => chaveItem(i) === k);
      if (idx === -1) return [...atual, novo];
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

  const cartao = (p: ProdutoVitrine, estreito = false) => (
    <CartaoProduto
      key={p.id}
      produto={p}
      icone={icone.get(p.categoriaId)!}
      quantidade={quantidadeDe(p)}
      estreito={estreito}
      adicionar={() => clicarProduto(p)}
      somar={(d) => somar(p, d)}
    />
  );

  if (tela === "checkout") {
    return (
      <Checkout
        dados={dados}
        itens={validos}
        porId={porId}
        voltar={() => setTela("catalogo")}
        concluido={() => setItens([])}
      />
    );
  }

  const painelCarrinho = (
    <Carrinho
      dados={dados}
      itens={validos}
      porId={porId}
      subtotal={subtotal}
      fechar={() => setGaveta(false)}
      editar={(p) => setModal(p)}
      salvar={salvarItem}
      remover={(k) => setItens((a) => a.filter((i) => chaveItem(i) !== k))}
      continuar={() => {
        setGaveta(false);
        setTela("checkout");
        window.scrollTo(0, 0);
      }}
    />
  );

  return (
    <div className="min-h-screen bg-[#f4f5f9]">
      <div className="bg-marca-azul-escuro text-blue-50">
        <p className="mx-auto flex max-w-7xl items-center justify-center gap-2 truncate px-4 py-1.5 text-xs font-semibold sm:text-[13px]">
          <IconeEntrega width={16} height={16} className="shrink-0 text-marca-amarelo" />
          Entregamos na sua casa
          {regras.freteGratisAcima != null && <span className="hidden sm:inline">· Frete grátis acima de {moeda(regras.freteGratisAcima)}</span>}
          {regras.pedidoMinimo > 0 && <span>· Mínimo {moeda(regras.pedidoMinimo)}</span>}
        </p>
      </div>
      <header className="sticky top-0 z-30 shadow-md">
        <div className="bg-marca-amarelo">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:gap-5 sm:py-2.5">
            <Logo nome={loja.nome} slug={loja.slug} />
            <label className="relative hidden flex-1 md:block">
              <span className="sr-only">Buscar produto</span>
              <IconeBusca className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-marca-azul" />
              <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="O que você procura hoje?" className="w-full rounded-full border-0 bg-white py-3 pr-4 pl-12 text-base text-gray-900 shadow-inner outline-none ring-marca-azul focus:ring-2" />
            </label>
            <span className={`ml-auto hidden shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold sm:inline-flex md:ml-0 ${situacao.aberta ? "bg-green-700 text-white" : "bg-marca-vermelho text-white"}`}>
              <IconeRelogio width={15} height={15} /> {situacao.mensagem}
            </span>
            <button type="button" onClick={() => setGaveta(true)} className="relative ml-auto inline-flex shrink-0 items-center gap-2 rounded-full bg-marca-azul px-3.5 py-2.5 font-bold text-white shadow hover:bg-marca-azul-escuro sm:ml-0 xl:hidden" aria-label={`Carrinho: ${qtdItens} itens`}>
              <IconeSacola />
              <span className="hidden text-sm sm:inline">{moeda(subtotal)}</span>
              {qtdItens > 0 && <span className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-marca-vermelho text-xs ring-2 ring-marca-amarelo">{qtdItens}</span>}
            </button>
          </div>
          <div className="px-4 pb-2.5 md:hidden">
            <label className="relative block">
              <span className="sr-only">Buscar produto</span>
              <IconeBusca className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-marca-azul" />
              <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="O que você procura hoje?" className="w-full rounded-full border-0 bg-white py-2.5 pr-4 pl-12 text-base text-gray-900 shadow-inner outline-none ring-marca-azul focus:ring-2" />
            </label>
          </div>
        </div>
        {!filtrados && (
          <nav className="overflow-x-auto bg-marca-azul [scrollbar-width:none] lg:hidden" aria-label="Categorias">
            <div className="mx-auto flex max-w-7xl gap-1.5 px-3 py-2">
              {categorias.map((c) => (
                <a
                  key={c.id}
                  id={`chip-${c.id}`}
                  href={`#cat-${c.id}`}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${ativa === c.id ? "bg-marca-amarelo text-marca-azul-escuro" : "text-white hover:bg-white/10"}`}
                >
                  {c.icone} {c.nome}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-5 pb-28 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_340px] xl:pb-10">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-0.5 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-black/5" aria-label="Categorias">
            <p className="px-3 pt-2 pb-1 text-xs font-bold tracking-wider text-gray-400 uppercase">Categorias</p>
            {categorias.map((c) => (
              <a
                key={c.id}
                href={`#cat-${c.id}`}
                onClick={() => setBusca("")}
                className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${ativa === c.id && !filtrados ? "bg-marca-amarelo text-marca-azul-escuro" : "text-gray-700 hover:bg-marca-azul-claro"}`}
              >
                <span className="truncate">{c.icone} {c.nome}</span>
                <span className="text-xs text-gray-400">{porCategoria.get(c.id)?.length ?? 0}</span>
              </a>
            ))}
          </nav>
        </aside>

        <main className="@container min-w-0">
          {!situacao.aberta && (
            <div className="mb-5 rounded-2xl bg-marca-vermelho p-4 text-white shadow">
              <p className="font-titulos text-xl font-bold">Estamos fechados agora</p>
              <p className="text-sm">{situacao.mensagem}. Você pode montar o carrinho, mas os pedidos só são aceitos no horário de funcionamento.</p>
            </div>
          )}

          {filtrados ? (
            <section>
              <p className="mb-4 text-sm text-gray-600">
                <strong className="text-gray-900">{filtrados.length}</strong> produto(s) para “{busca}”
                <button type="button" onClick={() => setBusca("")} className="ml-3 font-semibold text-marca-azul underline">limpar busca</button>
              </p>
              {filtrados.length === 0 ? (
                <p className="rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm">Nenhum produto encontrado. Tente outra palavra.</p>
              ) : (
                <ul className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5">{filtrados.map((p) => cartao(p))}</ul>
              )}
            </section>
          ) : (
            <>
              <section className="relative mb-6 overflow-hidden rounded-3xl bg-marca-azul text-white shadow-lg">
                <div className="absolute -top-16 -right-10 size-56 rounded-full bg-white/10" aria-hidden />
                <div className="absolute -bottom-24 left-1/3 size-64 rounded-full bg-white/5" aria-hidden />
                <div className="relative p-5 sm:p-7">
                  <p className="inline-block rounded-full bg-marca-vermelho px-3 py-1 text-xs font-extrabold tracking-wide uppercase">Ofertas da semana</p>
                  <h2 className="mt-2 font-titulos text-3xl leading-tight font-extrabold sm:text-4xl">
                    Preço baixo de verdade, <span className="text-marca-amarelo">entregue na sua porta</span>
                  </h2>
                  {loja.mensagem && <p className="mt-1 max-w-xl text-sm text-blue-100 sm:text-base">{loja.mensagem}</p>}
                </div>
                {ofertas.length > 0 && (
                  <ul className="relative flex snap-x gap-3 overflow-x-auto px-5 pb-5 [scrollbar-width:thin] sm:px-7 sm:pb-7">
                    {ofertas.map((p) => (
                      <li key={p.id} className="w-40 shrink-0 snap-start sm:w-44">
                        <CartaoProduto produto={p} icone={icone.get(p.categoriaId)!} quantidade={quantidadeDe(p)} estreito adicionar={() => clicarProduto(p)} somar={(d) => somar(p, d)} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <ul className="mb-8 grid grid-cols-1 gap-3 @lg:grid-cols-3">
                {[
                  { icone: <IconeEntrega />, titulo: "Entrega rápida", texto: regras.freteGratisAcima != null ? `Grátis acima de ${moeda(regras.freteGratisAcima)}` : "Direto na sua casa" },
                  { icone: <IconeCartao />, titulo: "Pague como quiser", texto: "Pix, cartão, vale-refeição ou dinheiro" },
                  { icone: <IconeRelogio />, titulo: situacao.aberta ? "Aberto agora" : "Fechado agora", texto: situacao.mensagem },
                ].map((b) => (
                  <li key={b.titulo} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-marca-amarelo text-marca-azul-escuro">{b.icone}</span>
                    <span>
                      <span className="block font-bold text-gray-900">{b.titulo}</span>
                      <span className="block text-sm text-gray-500">{b.texto}</span>
                    </span>
                  </li>
                ))}
              </ul>

              {categorias.map((c) => {
                const lista = porCategoria.get(c.id);
                if (!lista?.length) return null;
                return (
                  <section key={c.id} id={`cat-${c.id}`} data-categoria={c.id} className="scroll-mt-40 pb-8 md:scroll-mt-36 lg:scroll-mt-24">
                    <h2 className="mb-3 flex items-center gap-2 font-titulos text-2xl font-extrabold text-marca-azul-escuro">
                      <span className="grid size-9 place-items-center rounded-xl bg-marca-amarelo text-lg">{c.icone}</span>
                      {c.nome}
                      <span className="text-sm font-semibold text-gray-400">{lista.length}</span>
                    </h2>
                    <ul className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5">{lista.map((p) => cartao(p))}</ul>
                  </section>
                );
              })}
            </>
          )}
        </main>

        <aside className="hidden xl:block">
          <div className="sticky top-24 flex max-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">{painelCarrinho}</div>
        </aside>
      </div>

      <RodapeLoja loja={{ ...loja, horarios: dados.horarios }} />

      {qtdItens > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] xl:hidden">
          <button
            type="button"
            onClick={() => setGaveta(true)}
            className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 rounded-2xl bg-marca-azul px-5 py-3.5 text-white shadow-xl ring-4 ring-marca-amarelo/60"
          >
            <span className="flex items-center gap-2 font-bold">
              <span className="relative"><IconeSacola /><span className="absolute -top-2 -right-2.5 grid size-5 place-items-center rounded-full bg-marca-vermelho text-[11px]">{qtdItens}</span></span>
              Ver carrinho
            </span>
            <span className="font-titulos text-lg font-bold">{moeda(subtotal)}</span>
          </button>
        </div>
      )}

      {gaveta && (
        <div className="fixed inset-0 z-40 flex items-end justify-end bg-black/50 sm:items-stretch xl:hidden" onClick={() => setGaveta(false)}>
          <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-none sm:max-w-md sm:rounded-none" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Carrinho">
            {painelCarrinho}
          </div>
        </div>
      )}

      {modal && <ModalProduto produto={modal} icone={icone.get(modal.categoriaId)!} itens={itens} fechar={() => setModal(null)} salvar={salvarItem} />}
    </div>
  );
}

function Foto({ produto: p, icone, className = "" }: { produto: ProdutoVitrine; icone: string; className?: string }) {
  return p.imagemUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- fotos já otimizadas (WebP 480×360)
    <img src={p.imagemUrl} alt="" width={480} height={360} loading="lazy" decoding="async" className={`size-full object-cover ${className}`} />
  ) : (
    <span className={`grid size-full place-items-center text-5xl ${className}`} aria-hidden>{icone}</span>
  );
}

function CartaoProduto({
  produto: p,
  icone,
  quantidade,
  estreito,
  adicionar,
  somar,
}: {
  produto: ProdutoVitrine;
  icone: string;
  quantidade: number;
  estreito?: boolean;
  adicionar: () => void;
  somar: (delta: number) => void;
}) {
  const simples = p.unidade === "un" && p.precoVasilhame == null;
  const off = desconto(p);
  const Tag = estreito ? "div" : "li";
  return (
    <Tag className={`group flex h-full flex-col overflow-hidden rounded-2xl bg-white text-gray-900 shadow-sm ring-1 ring-black/5 transition hover:shadow-md ${p.disponivel ? "" : "opacity-60"}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-marca-amarelo-claro">
        <Foto produto={p} icone={icone} className="transition duration-300 group-hover:scale-105" />
        {off > 0 && <span className="absolute top-2 left-2 rounded-lg bg-marca-vermelho px-2 py-0.5 text-xs font-extrabold text-white shadow">-{off}%</span>}
        {p.unidade === "kg" && <span className="absolute bottom-2 left-2 rounded-lg bg-marca-azul/90 px-2 py-0.5 text-[11px] font-bold text-white">Peça pelo valor</span>}
        {p.precoVasilhame != null && <span className="absolute bottom-2 left-2 rounded-lg bg-marca-azul/90 px-2 py-0.5 text-[11px] font-bold text-white">Troca ou com vasilhame</span>}
        {quantidade > 0 && <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-marca-azul text-xs font-bold text-white ring-2 ring-white">{quantidade}</span>}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className={`line-clamp-2 font-semibold leading-snug ${estreito ? "min-h-9 text-[13px]" : "min-h-10 text-sm"}`}>{p.nome}</p>
        <div className="mt-1.5">
          {p.precoDe != null && <span className="block text-xs text-gray-400 line-through">{moeda(p.precoDe)}</span>}
          <span className={`font-titulos text-xl leading-none font-extrabold ${p.precoDe != null ? "text-marca-vermelho" : "text-marca-azul"}`}>{moeda(p.preco)}</span>
          {p.unidade === "kg" && <span className="text-xs font-semibold text-gray-500"> /kg</span>}
        </div>
        <div className="mt-auto pt-3">
          {!p.disponivel ? (
            <p className="rounded-xl bg-gray-100 py-2 text-center text-xs font-bold text-gray-500">Indisponível</p>
          ) : simples && quantidade > 0 ? (
            <div className="flex items-center justify-between rounded-xl bg-marca-azul text-white">
              <button type="button" className="grid size-10 place-items-center rounded-xl hover:bg-white/10" onClick={() => somar(-1)} aria-label={`Tirar um ${p.nome}`}><IconeMenos /></button>
              <span className="font-bold">{quantidade}</span>
              <button type="button" className="grid size-10 place-items-center rounded-xl hover:bg-white/10" onClick={() => somar(1)} aria-label={`Mais um ${p.nome}`}><IconeMais /></button>
            </div>
          ) : (
            <button type="button" onClick={adicionar} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-marca-amarelo text-sm font-extrabold text-marca-azul-escuro transition hover:bg-marca-amarelo-escuro active:scale-[.98]">
              {quantidade > 0 ? "Alterar" : <><IconeMais width={18} height={18} /> Adicionar</>}
            </button>
          )}
        </div>
      </div>
    </Tag>
  );
}

function ModalProduto({
  produto: p,
  icone,
  itens,
  fechar,
  salvar,
}: {
  produto: ProdutoVitrine;
  icone: string;
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
  const valido = valorNum >= VALOR_MIN_PESO && valorNum <= VALOR_MAX_PESO;
  const totalUn = (p.preco + (gas && temVasilhame === false ? p.precoVasilhame! : 0)) * quantidade;

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={fechar}>
      <div className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={p.nome}>
        <div className="relative aspect-[16/9] bg-marca-amarelo-claro">
          <Foto produto={p} icone={icone} />
          <button type="button" onClick={fechar} className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-white/90 text-gray-700 shadow" aria-label="Fechar"><IconeFechar /></button>
        </div>
        <div className="p-5">
          <h3 className="font-titulos text-2xl leading-tight font-extrabold text-marca-azul-escuro">{p.nome}</h3>
          <p className="mt-0.5 text-sm text-gray-600">
            <strong className="text-marca-azul">{moeda(p.preco)}</strong>
            {p.unidade === "kg" ? " o quilo" : gas ? " a troca" : " cada"}
          </p>

          {p.unidade === "kg" ? (
            <div className="mt-5">
              <p className="rotulo text-sm">Quanto você quer levar, em reais?</p>
              <div className="mb-3 grid grid-cols-4 gap-2">
                {[10, 20, 30, 50].map((v) => (
                  <button key={v} type="button" onClick={() => setValor(String(v))} className={`rounded-xl border-2 py-2 text-sm font-bold transition ${valorNum === v ? "border-marca-azul bg-marca-azul text-white" : "border-gray-200 hover:border-marca-azul"}`}>
                    R$ {v}
                  </button>
                ))}
              </div>
              <input inputMode="decimal" className="campo" placeholder="Outro valor, ex.: 25,00" value={valor} onChange={(e) => setValor(e.target.value)} />
              <p className="mt-3 rounded-xl bg-marca-amarelo-claro p-3 text-sm text-marca-azul-escuro">
                {valido ? <>Aproximadamente <strong>{quilos(Math.round((valorNum / p.preco) * 1000) / 1000)}</strong>. </> : null}
                Pesado na hora: a quantidade fica próxima do valor escolhido.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {gas && (
                <fieldset className="space-y-2">
                  <legend className="rotulo text-sm">Você tem o botijão vazio para troca?</legend>
                  {[
                    { v: true, t: "Sim, tenho o vazio", d: "Só a troca do gás", preco: p.preco },
                    { v: false, t: "Não, quero com o botijão", d: "Gás + vasilhame novo", preco: p.preco + p.precoVasilhame! },
                  ].map((o) => (
                    <label key={String(o.v)} className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 p-3.5 transition ${temVasilhame === o.v ? "border-marca-azul bg-marca-azul-claro" : "border-gray-200"}`}>
                      <span className="flex items-center gap-3">
                        <input type="radio" name="vasilhame" className="size-4 accent-marca-azul" checked={temVasilhame === o.v} onChange={() => setTemVasilhame(o.v)} />
                        <span><span className="block font-bold">{o.t}</span><span className="block text-xs text-gray-500">{o.d}</span></span>
                      </span>
                      <strong className="text-marca-azul">{moeda(o.preco)}</strong>
                    </label>
                  ))}
                </fieldset>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">Quantidade</span>
                <div className="flex items-center rounded-xl bg-gray-100">
                  <button type="button" className="grid size-11 place-items-center" onClick={() => setQuantidade((q) => Math.max(1, q - 1))} aria-label="Menos"><IconeMenos /></button>
                  <span className="w-8 text-center text-lg font-bold">{quantidade}</span>
                  <button type="button" className="grid size-11 place-items-center" onClick={() => setQuantidade((q) => Math.min(99, q + 1))} aria-label="Mais"><IconeMais /></button>
                </div>
              </div>
            </div>
          )}

          <label className="mt-4 block">
            <span className="rotulo text-sm">Observação (opcional)</span>
            <input className="campo" maxLength={200} placeholder={p.unidade === "kg" ? "ex.: moer duas vezes, cortar em bifes" : "ex.: bem gelada"} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </label>

          {erro && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          <button type="button" onClick={confirmar} className="mt-5 flex w-full items-center justify-between rounded-2xl bg-marca-azul px-5 py-3.5 font-bold text-white shadow-lg hover:bg-marca-azul-escuro">
            <span>{existente ? "Atualizar carrinho" : "Adicionar ao carrinho"}</span>
            <span className="font-titulos text-lg">{p.unidade === "kg" ? (valido ? moeda(valorNum) : "") : gas && temVasilhame === undefined ? "" : moeda(totalUn)}</span>
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
  const faltaFrete = regras.freteGratisAcima != null ? centavos(regras.freteGratisAcima - subtotal) : 0;
  const indisponivel = itens.some((i) => !porId.get(i.produtoId)?.disponivel);
  const icone = new Map(dados.categorias.map((c) => [c.id, c.icone ?? "🛒"]));

  return (
    <>
      <div className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="flex items-center gap-2 font-titulos text-xl font-extrabold text-marca-azul-escuro"><IconeSacola /> Seu carrinho</h2>
        <button type="button" onClick={fechar} className="grid size-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100 xl:hidden" aria-label="Fechar carrinho"><IconeFechar /></button>
      </div>
      {itens.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-gray-500">
          <span className="grid size-16 place-items-center rounded-full bg-marca-amarelo-claro text-marca-azul"><IconeSacola width={30} height={30} /></span>
          <p className="font-semibold text-gray-700">Seu carrinho está vazio</p>
          <p className="text-sm">Toque em “Adicionar” nos produtos para começar.</p>
        </div>
      ) : (
        <ul className="flex-1 divide-y overflow-y-auto px-5">
          {itens.map((i) => {
            const p = porId.get(i.produtoId)!;
            const r = calcularItem(i, p);
            const k = chaveItem(i);
            return (
              <li key={k} className="flex gap-3 py-3">
                <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-marca-amarelo-claro"><Foto produto={p} icone={icone.get(p.categoriaId)!} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <p className="text-sm leading-snug font-semibold">{p.nome}</p>
                    <p className="shrink-0 text-sm font-bold text-marca-azul">{typeof r === "string" ? "—" : moeda(r.total)}</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {p.unidade === "kg" && typeof r !== "string" && `${moeda(i.valor ?? 0)} ≈ ${quilos(r.quantidade)}`}
                    {i.temVasilhame === true && "Troca (tem o vazio)"}
                    {i.temVasilhame === false && "Com botijão"}
                    {i.observacao && ` · ${i.observacao}`}
                  </p>
                  {typeof r === "string" && <p className="text-xs text-red-700">{r}</p>}
                  <div className="mt-1.5 flex items-center gap-3 text-xs">
                    {p.unidade === "un" && (
                      <div className="flex items-center rounded-lg bg-gray-100">
                        <button type="button" className="grid size-7 place-items-center" onClick={() => salvar({ ...i, quantidade: (i.quantidade ?? 1) - 1 })} aria-label="Menos"><IconeMenos width={14} height={14} /></button>
                        <span className="w-6 text-center font-bold">{i.quantidade}</span>
                        <button type="button" className="grid size-7 place-items-center" onClick={() => salvar({ ...i, quantidade: Math.min(99, (i.quantidade ?? 1) + 1) })} aria-label="Mais"><IconeMais width={14} height={14} /></button>
                      </div>
                    )}
                    {(p.unidade === "kg" || p.precoVasilhame != null) && (
                      <button type="button" className="font-semibold text-marca-azul underline" onClick={() => editar(p)}>Alterar</button>
                    )}
                    <button type="button" className="ml-auto text-gray-400 hover:text-red-600" onClick={() => remover(k)} aria-label={`Remover ${p.nome}`}><IconeLixeira width={16} height={16} /></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="space-y-2 border-t bg-gray-50 px-5 py-4 text-sm">
        <div className="flex items-baseline justify-between"><span className="text-gray-600">Subtotal</span><strong className="font-titulos text-2xl text-marca-azul-escuro">{moeda(subtotal)}</strong></div>
        {itens.length > 0 && faltaFrete > 0 && falta <= 0 && (
          <div>
            <p className="text-xs text-gray-600">Faltam <strong>{moeda(faltaFrete)}</strong> para o frete grátis</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-green-600" style={{ width: `${Math.min(100, (subtotal / regras.freteGratisAcima!) * 100)}%` }} /></div>
          </div>
        )}
        {itens.length > 0 && faltaFrete <= 0 && regras.freteGratisAcima != null && <p className="text-xs font-bold text-green-700">Você ganhou frete grátis!</p>}
        {itens.length > 0 && falta > 0 && <p className="rounded-xl bg-marca-amarelo-claro p-2.5 text-xs text-marca-azul-escuro">Faltam <strong>{moeda(falta)}</strong> para o pedido mínimo de {moeda(regras.pedidoMinimo)}.</p>}
        {!situacao.aberta && <p className="rounded-xl bg-red-50 p-2.5 text-xs text-red-800">{situacao.mensagem}. Não estamos recebendo pedidos agora.</p>}
        <button
          type="button"
          disabled={falta > 0 || !situacao.aberta || indisponivel || itens.length === 0}
          onClick={continuar}
          className="w-full rounded-2xl bg-marca-azul py-3.5 font-bold text-white shadow-lg transition hover:bg-marca-azul-escuro disabled:opacity-40 disabled:shadow-none"
        >
          Finalizar pedido
        </button>
      </div>
    </>
  );
}
