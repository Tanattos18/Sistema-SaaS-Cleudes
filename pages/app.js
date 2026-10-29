// Demonstração estática da vitrine (GitHub Pages): mesmas regras do sistema completo,
// mas sem servidor. O pedido não é gravado; vai direto para o WhatsApp da loja.
"use strict";

const LOJA = {
  whatsapp: "5562981779460",
  pedidoMinimo: 40,
  taxaFixa: 5,
  freteGratisAcima: 150,
  // 0 = domingo … 6 = sábado
  horarios: [
    { dia: 0, abre: "06:00", fecha: "11:00" },
    ...[1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: "06:00", fecha: "20:00" })),
  ],
  formas: ["Pix na entrega", "Crédito na entrega", "Débito na entrega", "Vale-refeição na entrega", "Dinheiro na entrega"],
};
const VALOR_MIN_PESO = 5;
const VALOR_MAX_PESO = 500;
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_EXTENSO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const $ = (s) => document.querySelector(s);
const moedaFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const moeda = (v) => moedaFmt.format(v || 0);
const centavos = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const quilos = (q) => `${q.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
const numeroBR = (s) => Number(String(s).replace(/\./g, "").replace(",", "."));
const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

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
let itens = ler("demo:carrinho", []);
let busca = "";
const situacao = situacaoLoja();

const chave = (i) => `${i.produtoId}:${i.temVasilhame ?? ""}`;
function salvarCarrinho() {
  itens = itens.filter((i) => porId.has(i.produtoId));
  gravar("demo:carrinho", itens);
  renderProdutos();
  renderBarra();
  if (!$("#carrinho").hidden) abrirCarrinho();
}
function salvarItem(novo) {
  const k = chave(novo);
  const ok = novo.valor != null || (novo.quantidade || 0) > 0;
  const idx = itens.findIndex((i) => chave(i) === k);
  if (!ok) itens = itens.filter((i) => chave(i) !== k);
  else if (idx === -1) itens.push(novo);
  else itens[idx] = novo;
  salvarCarrinho();
}
function subtotal() {
  return centavos(itens.reduce((s, i) => {
    const r = calcularItem(i, porId.get(i.produtoId));
    return typeof r === "string" ? s : s + r.total;
  }, 0));
}
const qtdItens = () => itens.reduce((s, i) => s + (i.valor != null ? 1 : i.quantidade || 0), 0);

// ---------- vitrine ----------
function cartao(p) {
  const qtd = itens.filter((i) => i.produtoId === p.id).reduce((s, i) => s + (i.quantidade || (i.valor ? 1 : 0)), 0);
  const simples = p.unidade === "un" && p.precoVasilhame == null;
  const acao = simples && qtd > 0
    ? `<div class="contador"><button data-menos="${p.id}" aria-label="Tirar um">−</button><span>${qtd}</span><button data-mais="${p.id}" aria-label="Mais um">+</button></div>`
    : `<button class="botao-add" data-add="${p.id}">${qtd > 0 ? `No carrinho (${qtd}) · alterar` : "Adicionar"}</button>`;
  return `<li class="produto">
    <div class="icone" aria-hidden="true">${icone.get(p.categoriaId)}</div>
    <p class="nome">${esc(p.nome)}</p>
    <div class="preco">
      ${p.precoDe ? `<span class="preco-de">${moeda(p.precoDe)}</span>` : ""}
      <span class="preco-atual${p.precoDe ? " promo" : ""}">${moeda(p.preco)}</span>${p.unidade === "kg" ? '<span class="unid"> /kg</span>' : ""}
      ${p.precoVasilhame != null ? '<span class="sub">troca do vasilhame</span>' : ""}
    </div>
    <div class="acao">${acao}</div>
  </li>`;
}

function renderProdutos() {
  const termo = semAcento(busca.trim());
  $("#categorias").hidden = !!termo;
  if (termo) {
    const lista = catalogo.produtos.filter((p) => semAcento(p.nome).includes(termo));
    $("#produtos").innerHTML = `<p class="vazio">${lista.length} produto(s) para “${esc(busca)}”</p><ul class="grade">${lista.map(cartao).join("")}</ul>`;
    return;
  }
  $("#produtos").innerHTML = catalogo.categorias.map((c) => {
    const lista = catalogo.produtos.filter((p) => p.categoriaId === c.id);
    return `<section><h2 id="cat-${c.id}">${c.icone} ${esc(c.nome)}</h2><ul class="grade">${lista.map(cartao).join("")}</ul></section>`;
  }).join("");
}

function renderBarra() {
  const n = qtdItens();
  $("#barra-carrinho").hidden = n === 0;
  $("#resumo-carrinho").textContent = `${n} ${n === 1 ? "item" : "itens"} · ${moeda(subtotal())}`;
}

function somar(id, delta) {
  const atual = itens.find((i) => chave(i) === `${id}:`);
  salvarItem({ produtoId: id, quantidade: Math.min(99, Math.max(0, (atual?.quantidade || 0) + delta)) });
}

$("#produtos").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.mais) somar(Number(b.dataset.mais), 1);
  if (b.dataset.menos) somar(Number(b.dataset.menos), -1);
  if (b.dataset.add) {
    const p = porId.get(Number(b.dataset.add));
    if (p.unidade === "kg" || p.precoVasilhame != null) abrirModal(p);
    else somar(p.id, 1);
  }
});
$("#busca").addEventListener("input", (e) => { busca = e.target.value; renderProdutos(); });
$("#barra-carrinho").addEventListener("click", abrirCarrinho);

// ---------- janela do produto (peso / gás) ----------
function abrirModal(p) {
  const existente = itens.find((i) => i.produtoId === p.id) || {};
  const gas = p.precoVasilhame != null;
  let valor = existente.valor ? String(existente.valor).replace(".", ",") : "";
  let quantidade = existente.quantidade || 1;
  let temVasilhame = existente.temVasilhame;
  const m = $("#modal");

  function desenhar() {
    const v = numeroBR(valor);
    const corpo = p.unidade === "kg"
      ? `<p class="rotulo">Quanto você quer levar (em reais)?</p>
         <div class="chips">${[10, 20, 30, 50].map((x) => `<button type="button" data-valor="${x}" class="${v === x ? "ativo" : ""}">${moeda(x)}</button>`).join("")}</div>
         <label><input id="m-valor" inputmode="decimal" placeholder="Outro valor, ex.: 25,00" value="${esc(valor)}"></label>
         <p id="m-kg" class="rotulo">${v >= VALOR_MIN_PESO && v <= VALOR_MAX_PESO ? `≈ ${quilos(Math.round((v / p.preco) * 1000) / 1000)}` : "&nbsp;"}</p>
         <p class="aviso">Produto pesado na hora: a quantidade é aproximada ao valor escolhido.</p>`
      : `${gas ? `<p class="rotulo">Você tem o botijão vazio para troca?</p>
           <label class="opcao ${temVasilhame === true ? "ativo" : ""}"><span><input type="radio" name="vas" data-vas="1" ${temVasilhame === true ? "checked" : ""}> Sim, tenho o vazio (só troca)</span><strong>${moeda(p.preco)}</strong></label>
           <label class="opcao ${temVasilhame === false ? "ativo" : ""}"><span><input type="radio" name="vas" data-vas="0" ${temVasilhame === false ? "checked" : ""}> Não, quero com o botijão</span><strong>${moeda(p.preco + p.precoVasilhame)}</strong></label>` : ""}
         <div class="qtd"><span class="rotulo">Quantidade</span><div><button type="button" data-q="-1">−</button><span class="n">${quantidade}</span><button type="button" data-q="1">+</button></div></div>`;
    m.innerHTML = `<div class="janela" role="dialog" aria-modal="true" aria-label="${esc(p.nome)}">
      <h3>${esc(p.nome)}</h3>
      <p class="preco-ref">${moeda(p.preco)}${p.unidade === "kg" ? " o quilo" : gas ? " (troca)" : ""}</p>
      ${corpo}
      <p id="m-erro" class="erro" hidden></p>
      <div class="botoes"><button type="button" class="sec" data-fechar>Cancelar</button><button type="button" class="pri" data-ok>${existente.produtoId ? "Atualizar" : "Adicionar"}</button></div>
    </div>`;
    const inp = m.querySelector("#m-valor");
    if (inp) inp.addEventListener("input", (e) => {
      valor = e.target.value;
      const n = numeroBR(valor);
      m.querySelector("#m-kg").innerHTML = n >= VALOR_MIN_PESO && n <= VALOR_MAX_PESO ? `≈ ${quilos(Math.round((n / p.preco) * 1000) / 1000)}` : "&nbsp;";
      m.querySelectorAll("[data-valor]").forEach((b) => b.classList.toggle("ativo", Number(b.dataset.valor) === n));
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
}
function fecharModal() { $("#modal").hidden = true; $("#modal").innerHTML = ""; }

// ---------- carrinho ----------
function abrirCarrinho() {
  const c = $("#carrinho");
  const sub = subtotal();
  const falta = centavos(LOJA.pedidoMinimo - sub);
  c.innerHTML = `<aside class="gaveta" aria-label="Carrinho">
    <header><h2>Seu carrinho</h2><button data-fechar>Fechar ✕</button></header>
    <ul>${itens.map((i) => {
      const p = porId.get(i.produtoId);
      const r = calcularItem(i, p);
      const det = [
        p.unidade === "kg" && typeof r !== "string" ? `${moeda(i.valor)} ≈ ${quilos(r.quantidade)}` : "",
        i.temVasilhame === true ? "Troca (tem o vazio)" : i.temVasilhame === false ? "Com botijão" : "",
      ].filter(Boolean).join(" · ");
      return `<li>
        <div class="item-topo"><span>${esc(p.nome)}</span><strong>${typeof r === "string" ? "—" : moeda(r.total)}</strong></div>
        ${det ? `<p class="item-detalhe">${det}</p>` : ""}
        <div class="item-acoes">
          ${p.unidade === "un" ? `<div class="mini"><button data-k="${chave(i)}" data-d="-1">−</button><span>${i.quantidade}</span><button data-k="${chave(i)}" data-d="1">+</button></div>` : ""}
          ${p.unidade === "kg" || p.precoVasilhame != null ? `<button class="lnk" data-editar="${p.id}">Alterar</button>` : ""}
          <button class="lnk rem" data-remover="${chave(i)}">Remover</button>
        </div>
      </li>`;
    }).join("")}</ul>
    <footer>
      <div class="linha-total"><span>Subtotal</span><strong>${moeda(sub)}</strong></div>
      ${falta > 0 ? `<p class="alerta amarelo">Faltam ${moeda(falta)} para o pedido mínimo de ${moeda(LOJA.pedidoMinimo)}.</p>` : ""}
      ${!situacao.aberta ? `<p class="alerta vermelho">${situacao.mensagem}. Não estamos recebendo pedidos agora.</p>` : ""}
      <button class="botao-principal" data-continuar ${falta > 0 || !situacao.aberta || !itens.length ? "disabled" : ""}>Continuar para entrega e pagamento</button>
    </footer>
  </aside>`;
  c.hidden = false;
}
$("#carrinho").addEventListener("click", (e) => {
  const c = $("#carrinho");
  if (e.target === c || e.target.closest("[data-fechar]")) { c.hidden = true; return; }
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.k) {
    const i = itens.find((x) => chave(x) === b.dataset.k);
    salvarItem({ ...i, quantidade: Math.min(99, i.quantidade + Number(b.dataset.d)) });
  }
  if (b.dataset.remover) { itens = itens.filter((x) => chave(x) !== b.dataset.remover); salvarCarrinho(); }
  if (b.dataset.editar) abrirModal(porId.get(Number(b.dataset.editar)));
  if (b.dataset.continuar !== undefined) { c.hidden = true; abrirCheckout(); }
});

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
  $("#formas-pagamento").innerHTML = LOJA.formas.map((f, i) => `<label class="opcao ${forma === f ? "ativo" : ""}"><span><input type="radio" name="forma" value="${i}" ${forma === f ? "checked" : ""}> ${f}</span></label>`).join("");
  const t = totais();
  $("#totais").innerHTML = `
    <div class="linha-total"><span>Subtotal</span><span>${moeda(t.sub)}</span></div>
    <div class="linha-total"><span>Entrega</span><span>${t.taxa === 0 ? "grátis" : moeda(t.taxa)}</span></div>
    <div class="linha-total grande"><span>Total</span><span>${moeda(t.total)}</span></div>
    ${itens.some((i) => i.valor != null) ? '<p class="nota">Itens pesados na hora: quantidade aproximada ao valor escolhido.</p>' : ""}`;
  $("#erro-checkout").hidden = true;
  $("#tela-catalogo").hidden = true;
  $("#tela-checkout").hidden = false;
  window.scrollTo(0, 0);
}

$("#voltar-checkout").addEventListener("click", () => {
  $("#tela-checkout").hidden = true;
  $("#tela-catalogo").hidden = false;
  abrirCarrinho();
});
$("#formas-pagamento").addEventListener("change", (e) => {
  forma = LOJA.formas[Number(e.target.value)];
  document.querySelectorAll("#formas-pagamento .opcao").forEach((l) => l.classList.toggle("ativo", l.querySelector("input").checked));
  $("#bloco-troco").hidden = forma !== "Dinheiro na entrega";
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
  if (!tel) return erro("Informe um telefone com DDD, ex.: (62) 98177-9460.");
  if (d.rua.length < 2) return erro("Informe a rua.");
  if (!d.numero) return erro("Informe o número (ou S/N).");
  if (d.bairro.length < 2) return erro("Informe o bairro.");
  if (!forma) return erro("Escolha a forma de pagamento.");
  if (!situacaoLoja().aberta) return erro("A loja fechou. Não estamos recebendo pedidos agora.");
  const t = totais();
  if (t.sub < LOJA.pedidoMinimo) return erro(`O pedido mínimo é de ${moeda(LOJA.pedidoMinimo)}.`);
  let troco = null;
  if (forma === "Dinheiro na entrega" && $("#precisa-troco").checked) {
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
  linhas.push("", `*Pagamento:* ${forma}`);
  if (forma === "Dinheiro na entrega") linhas.push(troco ? `Troco para ${moeda(troco)}` : "Não precisa de troco");
  linhas.push("", `*Cliente:* ${d.nome}`, `*Telefone:* ${telefoneBR(tel)}`, `*Endereço:* ${d.rua}, ${d.numero}${d.complemento ? ` - ${d.complemento}` : ""} - ${d.bairro}`);
  if (d.referencia) linhas.push(`*Referência:* ${d.referencia}`);
  if (d.observacoes) linhas.push(`*Observações:* ${d.observacoes}`);

  itens = [];
  gravar("demo:carrinho", itens);
  window.location.href = `https://wa.me/${LOJA.whatsapp}?text=${encodeURIComponent(linhas.join("\n"))}`;
});

// ---------- início ----------
function iniciar() {
  const s = $("#situacao");
  s.textContent = situacao.mensagem;
  s.classList.add(situacao.aberta ? "aberta" : "fechada");
  $("#minimo").textContent = `Pedido mínimo ${moeda(LOJA.pedidoMinimo)}`;
  $("#frete-gratis").textContent = `Frete grátis acima de ${moeda(LOJA.freteGratisAcima)}`;
  $("#lista-horarios").innerHTML = DIAS.map((d, i) => {
    const h = LOJA.horarios.filter((x) => x.dia === i);
    return `<li>${d}: ${h.length ? h.map((x) => `${x.abre}–${x.fecha}`).join(", ") : "fechado"}</li>`;
  }).join("");
  $("#categorias").innerHTML = catalogo.categorias.map((c) => `<a href="#cat-${c.id}">${c.icone} ${esc(c.nome)}</a>`).join("");
  renderProdutos();
  salvarCarrinho();
}

fetch("catalogo.json")
  .then((r) => r.json())
  .then((dados) => {
    catalogo = dados;
    porId = new Map(dados.produtos.map((p) => [p.id, p]));
    icone = new Map(dados.categorias.map((c) => [c.id, c.icone]));
    iniciar();
  })
  .catch(() => { $("#produtos").innerHTML = '<p class="vazio">Não foi possível carregar os produtos. Recarregue a página.</p>'; });
