// Demonstração estática da vitrine (GitHub Pages): mesmas regras e visual do sistema completo,
// mas sem servidor. O pedido não é gravado; vai direto para o WhatsApp da loja.
"use strict";

const LOJA = {
  whatsapp: "556281517002",
  pedidoMinimo: 40,
  taxaFixa: 5,
  freteGratisAcima: 150,
  // 0 = domingo … 6 = sábado
  horarios: [
    { dia: 0, abre: "06:00", fecha: "11:00" },
    ...[1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: "06:00", fecha: "20:00" })),
  ],
  // [ícone, nome, explicação, pago no site?]
  formas: [
    ["⚡", "Pix", "Pague agora pelo Mercado Pago, aprovação na hora", true],
    ["💳", "Cartão de crédito ou débito", "Pague agora pelo Mercado Pago, com segurança", true],
    ["💵", "Dinheiro", "Pague ao entregador; informe se precisa de troco", false],
    ["📟", "Maquininha na entrega", "O entregador leva a maquininha (crédito, débito ou vale-refeição)", false],
  ],
};
const VALOR_MIN_PESO = 5;
const VALOR_MAX_PESO = 500;
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DIAS_EXTENSO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const $ = (s) => document.querySelector(s);
const moedaFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const moeda = (v) => moedaFmt.format(v || 0);
const centavos = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const quilos = (q) => `${q.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
const numeroBR = (s) => Number(String(s).replace(/\./g, "").replace(",", "."));
const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const desconto = (p) => (p.precoDe ? Math.round((1 - p.preco / p.precoDe) * 100) : 0);

function ler(chave, padrao) {
  try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; }
}
function gravar(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* navegação anônima */ }
}

// ---------- horário ----------
function agoraBrasilia() {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const v = (t) => p.find((x) => x.type === t).value;
  return { dia: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(v("weekday")), hora: `${v("hour")}:${v("minute")}` };
}
function situacaoLoja() {
  const { dia, hora } = agoraBrasilia();
  const doDia = (d) => LOJA.horarios.filter((h) => h.dia === d).sort((a, b) => a.abre.localeCompare(b.abre));
  const atual = doDia(dia).find((h) => hora >= h.abre && hora < h.fecha);
  if (atual) return { aberta: true, mensagem: `Aberto até ${atual.fecha}` };
  const tarde = doDia(dia).find((h) => h.abre > hora);
  if (tarde) return { aberta: false, mensagem: `Fechado agora. Abre hoje às ${tarde.abre}` };
  for (let i = 1; i <= 7; i++) {
    const d = (dia + i) % 7;
    const [prox] = doDia(d);
    if (prox) return { aberta: false, mensagem: `Fechado agora. Abre ${i === 1 ? "amanhã" : DIAS_EXTENSO[d]} às ${prox.abre}` };
  }
  return { aberta: false, mensagem: "Fechado no momento" };
}

// ---------- cálculo (espelho de src/lib/pedido.ts) ----------
function calcularItem(item, p) {
  if (!p) return "Produto indisponível.";
  if (p.unidade === "kg") {
    const v = item.valor || 0;
    if (!(v >= VALOR_MIN_PESO && v <= VALOR_MAX_PESO)) return `Escolha um valor entre R$ ${VALOR_MIN_PESO} e R$ ${VALOR_MAX_PESO}.`;
    return { quantidade: Math.round((v / p.preco) * 1000) / 1000, total: centavos(v) };
  }
  const q = item.quantidade || 0;
  if (!Number.isInteger(q) || q < 1 || q > 99) return "Quantidade inválida.";
  const gas = p.precoVasilhame != null;
  if (gas && typeof item.temVasilhame !== "boolean") return "Informe se você tem o botijão vazio para troca.";
  const vasilhame = gas && !item.temVasilhame ? p.precoVasilhame : 0;
  return { quantidade: q, total: centavos((p.preco + vasilhame) * q) };
}

// ---------- estado ----------
let catalogo = { categorias: [], produtos: [] };
let porId = new Map();
let icone = new Map();
let porCategoria = new Map();
let itens = ler("demo:carrinho", []);
let busca = "";
let ativa = null;
const situacao = situacaoLoja();

const chave = (i) => `${i.produtoId}:${i.temVasilhame ?? ""}`;
const fotoHtml = (p) => (p.foto ? `<img src="../public/produtos/${p.foto}.webp" alt="" width="480" height="360" loading="lazy" decoding="async">` : `<span class="sem-foto">${icone.get(p.categoriaId)}</span>`);

/** Grava o carrinho e redesenha só os cartões dos produtos alterados (ou tudo, sem `ids`). */
function salvarCarrinho(ids) {
  itens = itens.filter((i) => porId.has(i.produtoId));
  gravar("demo:carrinho", itens);
  if (!ids) renderPrincipal();
  else for (const id of ids) {
    document.querySelectorAll(`[data-produto="${id}"]`).forEach((el) => { el.outerHTML = cartao(porId.get(id), el.tagName.toLowerCase()); });
  }
  renderCarrinho();
}
function salvarItem(novo) {
  const k = chave(novo);
  const ok = novo.valor != null || (novo.quantidade || 0) > 0;
  const idx = itens.findIndex((i) => chave(i) === k);
  if (!ok) itens = itens.filter((i) => chave(i) !== k);
  else if (idx === -1) itens.push(novo);
  else itens[idx] = novo;
  salvarCarrinho([novo.produtoId]);
}
function subtotal() {
  return centavos(itens.reduce((s, i) => {
    const r = calcularItem(i, porId.get(i.produtoId));
    return typeof r === "string" ? s : s + r.total;
  }, 0));
}
const qtdItens = () => itens.reduce((s, i) => s + (i.valor != null ? 1 : i.quantidade || 0), 0);
const qtdDe = (p) => itens.filter((i) => i.produtoId === p.id).reduce((s, i) => s + (i.quantidade || (i.valor ? 1 : 0)), 0);

// ---------- vitrine ----------
function cartao(p, tag = "li") {
  const qtd = qtdDe(p);
  const simples = p.unidade === "un" && p.precoVasilhame == null;
  const off = desconto(p);
  const acao = !p.disponivel && p.disponivel !== undefined
    ? '<p class="esgotado">Indisponível</p>'
    : simples && qtd > 0
      ? `<div class="contador"><button data-menos="${p.id}" aria-label="Tirar um ${esc(p.nome)}">−</button><span>${qtd}</span><button data-mais="${p.id}" aria-label="Mais um ${esc(p.nome)}">+</button></div>`
      : `<button class="botao-add" data-add="${p.id}">${qtd > 0 ? "Alterar" : "+ Adicionar"}</button>`;
  return `<${tag} class="produto" data-produto="${p.id}">
    <div class="foto">${fotoHtml(p)}
      ${off > 0 ? `<span class="etiqueta off">-${off}%</span>` : ""}
      ${p.unidade === "kg" ? '<span class="etiqueta tipo">Peça pelo valor</span>' : ""}
      ${p.precoVasilhame != null ? '<span class="etiqueta tipo">Troca ou com vasilhame</span>' : ""}
      ${qtd > 0 ? `<span class="etiqueta qtd">${qtd}</span>` : ""}
    </div>
    <div class="info">
      <p class="nome">${esc(p.nome)}</p>
      <div class="preco">
        ${p.precoDe ? `<span class="preco-de">${moeda(p.precoDe)}</span>` : ""}
        <span class="preco-atual${p.precoDe ? " promo" : ""}">${moeda(p.preco)}</span>${p.unidade === "kg" ? '<span class="unid"> /kg</span>' : ""}
      </div>
      <div class="acao">${acao}</div>
    </div>
  </${tag}>`;
}

function renderPrincipal() {
  const termo = semAcento(busca.trim());
  $("#chips").hidden = !!termo;
  const fechado = situacao.aberta ? "" : `<div class="aviso-fechado"><strong>Estamos fechados agora</strong>${situacao.mensagem}. Você pode montar o carrinho, mas os pedidos só são aceitos no horário de funcionamento.</div>`;
  if (termo) {
    const lista = catalogo.produtos.filter((p) => semAcento(p.nome).includes(termo));
    $("#principal").innerHTML = `${fechado}<p class="resultado-busca"><strong>${lista.length}</strong> produto(s) para “${esc(busca)}”<button type="button" data-limpar>limpar busca</button></p>
      ${lista.length ? `<ul class="grade">${lista.map((p) => cartao(p)).join("")}</ul>` : '<p class="vazio">Nenhum produto encontrado. Tente outra palavra.</p>'}`;
    return;
  }
  const rolagem = $(".carrossel")?.scrollLeft ?? 0;
  const ofertas = catalogo.produtos.filter((p) => p.precoDe).sort((a, b) => desconto(b) - desconto(a));
  $("#principal").innerHTML = `${fechado}
    <section class="hero">
      <div class="hero-texto">
        <span class="selo-vermelho">Ofertas da semana</span>
        <h2>Preço baixo de verdade, <em>entregue na sua porta</em></h2>
        <p>Açougue, padaria, supermercado, gás e bebidas. Entregamos na sua casa!</p>
      </div>
      <ul class="carrossel">${ofertas.map((p) => `<li>${cartao(p, "div")}</li>`).join("")}</ul>
    </section>
    <ul class="beneficios">
      <li><span class="ico">🚚</span><span><strong>Entrega rápida</strong><small>Grátis acima de ${moeda(LOJA.freteGratisAcima)}</small></span></li>
      <li><span class="ico">💳</span><span><strong>Pague como quiser</strong><small>Pix, cartão, vale-refeição ou dinheiro</small></span></li>
      <li><span class="ico">🕒</span><span><strong>${situacao.aberta ? "Aberto agora" : "Fechado agora"}</strong><small>${situacao.mensagem}</small></span></li>
    </ul>
    ${catalogo.categorias.map((c) => {
      const lista = porCategoria.get(c.id) || [];
      return `<section class="categoria" id="cat-${c.id}" data-categoria="${c.id}">
        <h2><span class="ico">${c.icone}</span>${esc(c.nome)} <small>${lista.length}</small></h2>
        <ul class="grade">${lista.map((p) => cartao(p)).join("")}</ul>
      </section>`;
    }).join("")}`;
  const car = $(".carrossel");
  if (car) car.scrollLeft = rolagem;
  observarCategorias();
}

let observador;
function observarCategorias() {
  observador?.disconnect();
  observador = new IntersectionObserver((entradas) => {
    const vis = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (vis) marcarAtiva(Number(vis.target.dataset.categoria));
  }, { rootMargin: "-140px 0px -60% 0px" });
  document.querySelectorAll("[data-categoria]").forEach((el) => observador.observe(el));
}
function marcarAtiva(id) {
  if (ativa === id) return;
  ativa = id;
  document.querySelectorAll("[data-ir]").forEach((a) => a.classList.toggle("ativa", Number(a.dataset.ir) === id));
  document.querySelector(`#chips [data-ir="${id}"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
}

function somar(id, delta) {
  const atual = itens.find((i) => chave(i) === `${id}:`);
  salvarItem({ produtoId: id, quantidade: Math.min(99, Math.max(0, (atual?.quantidade || 0) + delta)) });
}

$("#principal").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.mais) somar(Number(b.dataset.mais), 1);
  if (b.dataset.menos) somar(Number(b.dataset.menos), -1);
  if (b.dataset.limpar !== undefined) definirBusca("");
  if (b.dataset.add) {
    const p = porId.get(Number(b.dataset.add));
    if (p.unidade === "kg" || p.precoVasilhame != null) abrirModal(p);
    else somar(p.id, 1);
  }
});
function definirBusca(v) {
  busca = v;
  document.querySelectorAll(".campo-busca").forEach((i) => { if (i.value !== v) i.value = v; });
  renderPrincipal();
}
document.querySelectorAll(".campo-busca").forEach((i) => i.addEventListener("input", (e) => definirBusca(e.target.value)));

// ---------- carrinho (painel fixo no computador, gaveta no celular/tablet) ----------
function htmlCarrinho() {
  const sub = subtotal();
  const falta = centavos(LOJA.pedidoMinimo - sub);
  const faltaFrete = centavos(LOJA.freteGratisAcima - sub);
  const lista = itens.length
    ? `<ul class="itens">${itens.map((i) => {
        const p = porId.get(i.produtoId);
        const r = calcularItem(i, p);
        const det = [
          p.unidade === "kg" && typeof r !== "string" ? `${moeda(i.valor)} ≈ ${quilos(r.quantidade)}` : "",
          i.temVasilhame === true ? "Troca (tem o vazio)" : i.temVasilhame === false ? "Com botijão" : "",
        ].filter(Boolean).join(" · ");
        return `<li>
          <div class="miniatura">${fotoHtml(p)}</div>
          <div class="item-corpo">
            <div class="item-topo"><span>${esc(p.nome)}</span><strong>${typeof r === "string" ? "—" : moeda(r.total)}</strong></div>
            ${det ? `<p class="item-detalhe">${det}</p>` : ""}
            <div class="item-acoes">
              ${p.unidade === "un" ? `<div class="mini"><button data-k="${chave(i)}" data-d="-1" aria-label="Menos">−</button><span>${i.quantidade}</span><button data-k="${chave(i)}" data-d="1" aria-label="Mais">+</button></div>` : ""}
              ${p.unidade === "kg" || p.precoVasilhame != null ? `<button class="lnk" data-editar="${p.id}">Alterar</button>` : ""}
              <button class="lixo" data-remover="${chave(i)}" aria-label="Remover ${esc(p.nome)}">🗑</button>
            </div>
          </div>
        </li>`;
      }).join("")}</ul>`
    : '<div class="carrinho-vazio"><span class="bola">🛍️</span><strong>Seu carrinho está vazio</strong><span>Toque em “Adicionar” nos produtos para começar.</span></div>';
  return `<div class="carrinho-topo"><h2>🛍️ Seu carrinho</h2><button class="fechar" data-fechar aria-label="Fechar carrinho">✕</button></div>
    ${lista}
    <div class="carrinho-rodape">
      <div class="linha-total"><span>Subtotal</span><strong class="grande">${moeda(sub)}</strong></div>
      ${itens.length && faltaFrete > 0 && falta <= 0 ? `<small>Faltam <strong>${moeda(faltaFrete)}</strong> para o frete grátis</small><div class="progresso"><div style="width:${Math.min(100, (sub / LOJA.freteGratisAcima) * 100)}%"></div></div>` : ""}
      ${itens.length && faltaFrete <= 0 ? '<p class="ganhou">Você ganhou frete grátis!</p>' : ""}
      ${itens.length && falta > 0 ? `<p class="alerta amarelo">Faltam <strong>${moeda(falta)}</strong> para o pedido mínimo de ${moeda(LOJA.pedidoMinimo)}.</p>` : ""}
      ${!situacao.aberta ? `<p class="alerta vermelho">${situacao.mensagem}. Não estamos recebendo pedidos agora.</p>` : ""}
      <button class="botao-principal" data-continuar ${falta > 0 || !situacao.aberta || !itens.length ? "disabled" : ""}>Finalizar pedido</button>
    </div>`;
}
function renderCarrinho() {
  const html = htmlCarrinho();
  $("#painel-carrinho").innerHTML = html;
  if (!$("#gaveta").hidden) $("#gaveta-conteudo").innerHTML = html;
  const n = qtdItens();
  const sub = moeda(subtotal());
  $("#barra-carrinho").hidden = n === 0;
  $("#qtd-barra").textContent = n;
  $("#total-barra").textContent = sub;
  $("#total-topo").textContent = sub;
  $("#contagem").hidden = n === 0;
  $("#contagem").textContent = n;
}
function abrirGaveta() {
  $("#gaveta-conteudo").innerHTML = htmlCarrinho();
  $("#gaveta").hidden = false;
  document.body.style.overflow = "hidden";
}
function fecharGaveta() {
  $("#gaveta").hidden = true;
  document.body.style.overflow = "";
}
$("#abrir-carrinho").addEventListener("click", abrirGaveta);
$("#barra-carrinho").addEventListener("click", abrirGaveta);
function cliqueCarrinho(e) {
  if (e.target === $("#gaveta") || e.target.closest("[data-fechar]")) return fecharGaveta();
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.k) {
    const i = itens.find((x) => chave(x) === b.dataset.k);
    salvarItem({ ...i, quantidade: Math.min(99, i.quantidade + Number(b.dataset.d)) });
  }
  if (b.dataset.remover) { itens = itens.filter((x) => chave(x) !== b.dataset.remover); salvarCarrinho([Number(b.dataset.remover.split(":")[0])]); }
  if (b.dataset.editar) abrirModal(porId.get(Number(b.dataset.editar)));
  if (b.dataset.continuar !== undefined) { fecharGaveta(); abrirCheckout(); }
}
$("#gaveta").addEventListener("click", cliqueCarrinho);
$("#painel-carrinho").addEventListener("click", cliqueCarrinho);

// ---------- janela do produto (peso / gás) ----------
function abrirModal(p) {
  const existente = itens.find((i) => i.produtoId === p.id) || {};
  const gas = p.precoVasilhame != null;
  let valor = existente.valor ? String(existente.valor).replace(".", ",") : "";
  let quantidade = existente.quantidade || 1;
  let temVasilhame = existente.temVasilhame;
  const m = $("#modal");

  function rodape() {
    const v = numeroBR(valor);
    const total = p.unidade === "kg"
      ? (v >= VALOR_MIN_PESO && v <= VALOR_MAX_PESO ? moeda(v) : "")
      : gas && temVasilhame === undefined ? "" : moeda((p.preco + (gas && temVasilhame === false ? p.precoVasilhame : 0)) * quantidade);
    return `<span>${existente.produtoId ? "Atualizar carrinho" : "Adicionar ao carrinho"}</span><strong>${total}</strong>`;
  }
  function textoPeso() {
    const v = numeroBR(valor);
    return `${v >= VALOR_MIN_PESO && v <= VALOR_MAX_PESO ? `Aproximadamente <strong>${quilos(Math.round((v / p.preco) * 1000) / 1000)}</strong>. ` : ""}Pesado na hora: a quantidade fica próxima do valor escolhido.`;
  }
  function desenhar() {
    const v = numeroBR(valor);
    const corpo = p.unidade === "kg"
      ? `<span class="rotulo">Quanto você quer levar, em reais?</span>
         <div class="valores">${[10, 20, 30, 50].map((x) => `<button type="button" data-valor="${x}" class="${v === x ? "ativo" : ""}">R$ ${x}</button>`).join("")}</div>
         <input id="m-valor" class="campo" inputmode="decimal" placeholder="Outro valor, ex.: 25,00" value="${esc(valor)}">
         <p class="aviso-peso" id="m-kg">${textoPeso()}</p>`
      : `${gas ? `<span class="rotulo">Você tem o botijão vazio para troca?</span>
           <label class="opcao-gas ${temVasilhame === true ? "ativo" : ""}"><span><input type="radio" name="vas" data-vas="1" ${temVasilhame === true ? "checked" : ""}> <span><b>Sim, tenho o vazio</b><small>Só a troca do gás</small></span></span><strong>${moeda(p.preco)}</strong></label>
           <label class="opcao-gas ${temVasilhame === false ? "ativo" : ""}"><span><input type="radio" name="vas" data-vas="0" ${temVasilhame === false ? "checked" : ""}> <span><b>Não, quero com o botijão</b><small>Gás + vasilhame novo</small></span></span><strong>${moeda(p.preco + p.precoVasilhame)}</strong></label>` : ""}
         <div class="linha-qtd"><span>Quantidade</span><div class="passo-qtd"><button type="button" data-q="-1" aria-label="Menos">−</button><span>${quantidade}</span><button type="button" data-q="1" aria-label="Mais">+</button></div></div>`;
    m.innerHTML = `<div class="janela" role="dialog" aria-modal="true" aria-label="${esc(p.nome)}">
      <div class="janela-foto">${fotoHtml(p)}<button type="button" class="fechar" data-fechar aria-label="Fechar">✕</button></div>
      <div class="janela-corpo">
        <h3>${esc(p.nome)}</h3>
        <p class="preco-ref"><strong>${moeda(p.preco)}</strong>${p.unidade === "kg" ? " o quilo" : gas ? " a troca" : " cada"}</p>
        ${corpo}
        <p id="m-erro" class="erro" hidden></p>
        <button type="button" class="botao-confirmar" data-ok>${rodape()}</button>
      </div>
    </div>`;
    const inp = m.querySelector("#m-valor");
    if (inp) inp.addEventListener("input", (e) => {
      valor = e.target.value;
      m.querySelector("#m-kg").innerHTML = textoPeso();
      m.querySelector("[data-ok]").innerHTML = rodape();
      m.querySelectorAll("[data-valor]").forEach((b) => b.classList.toggle("ativo", Number(b.dataset.valor) === numeroBR(valor)));
    });
  }

  m.onclick = (e) => {
    if (e.target === m || e.target.closest("[data-fechar]")) return fecharModal();
    const b = e.target.closest("[data-valor],[data-q],[data-vas],[data-ok]");
    if (!b) return;
    if (b.dataset.valor) { valor = b.dataset.valor; desenhar(); }
    if (b.dataset.q) { quantidade = Math.min(99, Math.max(1, quantidade + Number(b.dataset.q))); desenhar(); }
    if (b.dataset.vas) { temVasilhame = b.dataset.vas === "1"; desenhar(); }
    if (b.dataset.ok !== undefined) {
      const item = p.unidade === "kg" ? { produtoId: p.id, valor: centavos(numeroBR(valor)) } : { produtoId: p.id, quantidade, temVasilhame: gas ? temVasilhame : undefined };
      const r = calcularItem(item, p);
      if (typeof r === "string") { const er = m.querySelector("#m-erro"); er.textContent = r; er.hidden = false; return; }
      salvarItem(item);
      fecharModal();
    }
  };
  desenhar();
  m.hidden = false;
  document.body.style.overflow = "hidden";
}
function fecharModal() {
  $("#modal").hidden = true;
  $("#modal").innerHTML = "";
  if ($("#gaveta").hidden) document.body.style.overflow = "";
}

// ---------- checkout ----------
const form = $("#form-checkout");
let forma = null;

function totais() {
  const sub = subtotal();
  const taxa = sub >= LOJA.freteGratisAcima ? 0 : LOJA.taxaFixa;
  return { sub, taxa, total: centavos(sub + taxa) };
}

function abrirCheckout() {
  const dados = ler("demo:cliente", {});
  for (const [k, v] of Object.entries(dados)) if (form.elements[k]) form.elements[k].value = v;
  $("#formas-pagamento").innerHTML = LOJA.formas.map(([ic, f, txt], i) => `<label class="opcao ${forma === f ? "ativo" : ""}"><input type="radio" name="forma" value="${i}" ${forma === f ? "checked" : ""}><span class="ico-pag" aria-hidden="true">${ic}</span><span><b>${f}</b><small>${txt}</small></span></label>`).join("");
  $("#resumo-itens").innerHTML = itens.map((i) => {
    const p = porId.get(i.produtoId);
    const r = calcularItem(i, p);
    const det = (p.unidade === "kg" ? `≈ ${quilos(r.quantidade)}` : `${i.quantidade}×`) + (i.temVasilhame === true ? " · troca" : i.temVasilhame === false ? " · com botijão" : "");
    return `<li><div class="miniatura">${fotoHtml(p)}</div><div><p>${esc(p.nome)}</p><small>${det}</small></div><strong>${moeda(r.total)}</strong></li>`;
  }).join("");
  const t = totais();
  $("#totais").innerHTML = `
    <div class="linha-total"><span>Subtotal</span><span>${moeda(t.sub)}</span></div>
    <div class="linha-total"><span>Entrega</span><span class="${t.taxa === 0 ? "gratis" : ""}">${t.taxa === 0 ? "grátis" : moeda(t.taxa)}</span></div>
    <div class="linha-total"><strong>Total</strong><strong class="grande">${moeda(t.total)}</strong></div>
    ${itens.some((i) => i.valor != null) ? '<p class="nota">Itens pesados na hora: quantidade aproximada ao valor escolhido.</p>' : ""}`;
  $("#erro-checkout").hidden = true;
  $("#tela-catalogo").hidden = true;
  $("#tela-checkout").hidden = false;
  window.scrollTo(0, 0);
}

$("#voltar-checkout").addEventListener("click", () => {
  $("#tela-checkout").hidden = true;
  $("#tela-catalogo").hidden = false;
  renderPrincipal();
  if (innerWidth < 1280) abrirGaveta();
});
$("#formas-pagamento").addEventListener("change", (e) => {
  forma = LOJA.formas[Number(e.target.value)][1];
  $("#aviso-online").hidden = !pagoNoSite();
  $("#botao-enviar").textContent = pagoNoSite() ? `Pagar ${moeda(totais().total)} com ${forma === "Pix" ? "Pix" : "cartão"}` : "Enviar pedido pelo WhatsApp";
  document.querySelectorAll("#formas-pagamento .opcao").forEach((l) => l.classList.toggle("ativo", l.querySelector("input").checked));
  $("#bloco-troco").hidden = forma !== "Dinheiro";
});
$("#precisa-troco").addEventListener("change", (e) => { $("#campo-troco").hidden = !e.target.checked; });

function normalizarTelefone(bruto) {
  let d = bruto.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  return d.length === 10 || d.length === 11 ? d : "";
}
const telefoneBR = (d) => (d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`);

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const erro = (msg) => { const el = $("#erro-checkout"); el.textContent = msg; el.hidden = false; el.scrollIntoView({ block: "center" }); };
  const d = Object.fromEntries(new FormData(form));
  for (const k of Object.keys(d)) if (typeof d[k] === "string") d[k] = d[k].trim();
  if (d.nome.length < 2) return erro("Informe seu nome.");
  const tel = normalizarTelefone(d.telefone);
  if (!tel) return erro("Informe um telefone com DDD, ex.: (62) 99999-0000.");
  if (d.rua.length < 2) return erro("Informe a rua.");
  if (!d.numero) return erro("Informe o número (ou S/N).");
  if (d.bairro.length < 2) return erro("Informe o bairro.");
  if (!forma) return erro("Escolha a forma de pagamento.");
  if (!situacaoLoja().aberta) return erro("A loja fechou. Não estamos recebendo pedidos agora.");
  const t = totais();
  if (t.sub < LOJA.pedidoMinimo) return erro(`O pedido mínimo é de ${moeda(LOJA.pedidoMinimo)}.`);
  let troco = null;
  if (forma === "Dinheiro" && $("#precisa-troco").checked) {
    troco = numeroBR($("#troco").value);
    if (!(troco > 0)) return erro("Informe para quanto precisa de troco.");
    if (troco < t.total) return erro("O valor para troco precisa ser maior que o total do pedido.");
  }
  gravar("demo:cliente", { nome: d.nome, telefone: d.telefone, rua: d.rua, numero: d.numero, complemento: d.complemento, bairro: d.bairro, referencia: d.referencia });

  const linhas = ["*PEDIDO DE TESTE (demonstração do site)*", ""];
  for (const i of itens) {
    const p = porId.get(i.produtoId);
    const r = calcularItem(i, p);
    if (p.unidade === "kg") linhas.push(`• ${p.nome}: ${moeda(r.total)} (≈ ${quilos(r.quantidade)} a ${moeda(p.preco)}/kg)`);
    else {
      const gas = i.temVasilhame == null ? "" : i.temVasilhame ? " [troca: tem o vazio]" : " [sem vasilhame: leva o botijão]";
      linhas.push(`• ${i.quantidade}x ${p.nome}${gas}: ${moeda(r.total)}`);
    }
  }
  linhas.push("", `Subtotal: ${moeda(t.sub)}`, `Entrega: ${t.taxa === 0 ? "grátis" : moeda(t.taxa)}`, `*Total: ${moeda(t.total)}*`);
  if (itens.some((i) => i.valor != null)) linhas.push("_Itens por peso: valor aproximado, conferido na pesagem._");
  linhas.push("", `*Pagamento:* ${forma}${pagoNoSite() ? " (PAGO no site - simulação)" : ""}`);
  if (forma === "Dinheiro") linhas.push(troco ? `Troco para ${moeda(troco)}` : "Não precisa de troco");
  linhas.push("", `*Cliente:* ${d.nome}`, `*Telefone:* ${telefoneBR(tel)}`, `*Endereço:* ${d.rua}, ${d.numero}${d.complemento ? ` - ${d.complemento}` : ""} - ${d.bairro}`);
  if (d.referencia) linhas.push(`*Referência:* ${d.referencia}`);
  if (d.observacoes) linhas.push(`*Observações:* ${d.observacoes}`);

  const enviar = () => {
    itens = [];
    gravar("demo:carrinho", itens);
    window.location.href = `https://wa.me/${LOJA.whatsapp}?text=${encodeURIComponent(linhas.join("\n"))}`;
  };
  // Na versão completa o cliente vai para o Mercado Pago; aqui uma tela simula o pagamento.
  if (pagoNoSite()) simularPagamento(t.total, enviar);
  else enviar();
});

const pagoNoSite = () => !!LOJA.formas.find((f) => f[1] === forma)?.[3];

function simularPagamento(total, aprovado) {
  const m = $("#modal");
  const pix = forma === "Pix";
  m.innerHTML = `<div class="janela mp" role="dialog" aria-modal="true" aria-label="Pagamento">
    <div class="mp-topo"><strong>Mercado Pago</strong><span>Simulação da demonstração</span></div>
    <div class="janela-corpo">
      <p class="mp-valor">${moeda(total)}</p>
      <p class="preco-ref">Pedido no Supermercado Caixeta · ${pix ? "Pix" : "Cartão de crédito ou débito"}</p>
      ${pix
        ? `<div class="mp-qr" aria-hidden="true"></div><p class="nota">Na versão completa aparece aqui o QR Code do Pix (e o código “copia e cola”) gerado pelo Mercado Pago.</p>`
        : `<div class="mp-cartao"><span>•••• •••• •••• 4242</span><span>VALIDADE 12/30</span></div><p class="nota">Na versão completa o cliente digita o cartão na página segura do Mercado Pago.</p>`}
      <button type="button" class="botao-confirmar" data-aprovar><span>Simular pagamento aprovado</span><strong>✓</strong></button>
      <button type="button" class="lnk" data-fechar style="margin-top:12px">Voltar e escolher outra forma</button>
    </div>
  </div>`;
  m.onclick = (e) => {
    if (e.target === m || e.target.closest("[data-fechar]")) return fecharModal();
    if (e.target.closest("[data-aprovar]")) {
      m.querySelector(".janela-corpo").innerHTML = '<p class="mp-ok">✓</p><p class="mp-valor">Pagamento aprovado!</p><p class="preco-ref">O pedido já foi para a loja separar. Abrindo o WhatsApp da loja…</p>';
      setTimeout(aprovado, 1600);
    }
  };
  m.hidden = false;
  document.body.style.overflow = "hidden";
}

// ---------- início ----------
function iniciar() {
  const s = $("#situacao");
  s.textContent = `🕒 ${situacao.mensagem}`;
  s.classList.add(situacao.aberta ? "aberta" : "fechada");
  $("#rodape-horarios").innerHTML = DIAS.map((d, i) => {
    const h = LOJA.horarios.filter((x) => x.dia === i);
    return `<li><span>${d}</span><span>${h.length ? h.map((x) => `${x.abre}–${x.fecha}`).join(", ") : "fechado"}</span></li>`;
  }).join("");
  const link = (c) => `<a href="#cat-${c.id}" data-ir="${c.id}">${c.icone} ${esc(c.nome)}</a>`;
  $("#chips").innerHTML = catalogo.categorias.map(link).join("");
  $("#menu-categorias").innerHTML = "<p>Categorias</p>" + catalogo.categorias.map((c) => `<a href="#cat-${c.id}" data-ir="${c.id}"><span>${c.icone} ${esc(c.nome)}</span><small>${(porCategoria.get(c.id) || []).length}</small></a>`).join("");
  $("#menu-categorias").addEventListener("click", (e) => { if (e.target.closest("a") && busca) definirBusca(""); });
  salvarCarrinho();
}

fetch("catalogo.json")
  .then((r) => r.json())
  .then((dados) => {
    catalogo = dados;
    porId = new Map(dados.produtos.map((p) => [p.id, p]));
    icone = new Map(dados.categorias.map((c) => [c.id, c.icone]));
    for (const p of dados.produtos) porCategoria.set(p.categoriaId, [...(porCategoria.get(p.categoriaId) || []), p]);
    iniciar();
  })
  .catch(() => { $("#principal").innerHTML = '<p class="vazio">Não foi possível carregar os produtos. Recarregue a página.</p>'; });

// Aplicativo instalável e funcionando com internet fraca.
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
