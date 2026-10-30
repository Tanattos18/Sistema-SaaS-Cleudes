#!/usr/bin/env node
// Programa de impressão do balcão: busca os pedidos novos no sistema e imprime o comprovante
// na térmica Epson TM-T88V (ESC/POS, bobina de 80 mm) ou numa impressora comum (laser/jato de
// tinta, folha A4). Sem dependências: só o Node.js 18 ou mais novo.
//
//   node agente.js            fica rodando e imprime cada pedido novo
//   node agente.js teste      imprime uma página de teste e sai
//
// Configuração em config.json, na mesma pasta (baixe pronto no painel: Configurações > Impressora).
// A impressora escolhida no painel (Configurações > Impressora do balcão) vale mais que a do config.json.
"use strict";

const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");

const PASTA = __dirname;
const LOG = path.join(PASTA, "agente.log");

function registrar(msg) {
  const linha = `[${new Date().toLocaleString("pt-BR")}] ${msg}`;
  console.log(linha);
  try {
    fs.appendFileSync(LOG, linha + os.EOL);
  } catch {
    // sem permissão de escrita na pasta: só mostra na tela
  }
}

function lerConfig() {
  const arquivo = path.join(PASTA, "config.json");
  if (!fs.existsSync(arquivo)) {
    throw new Error("Falta o config.json nesta pasta. Baixe no painel: Configurações > Impressora do balcão.");
  }
  const c = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  if (!c.sistema || !c.chave) throw new Error("config.json sem o endereço do sistema ou sem a chave.");
  c.sistema = String(c.sistema).replace(/\/$/, "");
  c.impressora = c.impressora || {};
  c.impressora.tipo = c.impressora.tipo || "windows";
  c.copias = Math.max(1, Math.min(5, Number(c.copias) || 1));
  c.intervaloSegundos = Math.max(2, Number(c.intervaloSegundos) || 5);
  return c;
}

// ---------- ESC/POS ----------
const ESC = 0x1b;
const GS = 0x1d;
const CMD = {
  iniciar: [ESC, 0x40],
  // Tabela de caracteres WPC1252 (acentos do português) na TM-T88V.
  tabela1252: [ESC, 0x74, 16],
  alinhar: (n) => [ESC, 0x61, n], // 0 esquerda, 1 centro
  negrito: (on) => [ESC, 0x45, on ? 1 : 0],
  tamanho: (dupla) => [GS, 0x21, dupla ? 0x11 : 0x00], // largura e altura dupla
  avancar: (n) => [ESC, 0x64, n],
  cortar: [GS, 0x56, 66, 3], // avança um pouco e corta parcial
};

// Caracteres fora da tabela 1252 viram equivalentes simples.
function paraBytes(texto) {
  const simples = texto
    .replace(/[   ]/g, " ")
    .replace(/[≈∼]/g, "~")
    .replace(/[•·]/g, "*")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x00-\xff]/g, "?");
  return Buffer.from(simples, "latin1");
}

/** Linhas do comprovante (vindas do sistema) → bytes ESC/POS. */
function montarEscPos(linhas) {
  const partes = [Buffer.from([...CMD.iniciar, ...CMD.tabela1252])];
  for (const l of linhas) {
    partes.push(Buffer.from([...CMD.alinhar(l.centro ? 1 : 0), ...CMD.negrito(!!(l.negrito || l.grande)), ...CMD.tamanho(!!l.grande)]));
    partes.push(paraBytes(l.texto || ""), Buffer.from([0x0a]));
  }
  partes.push(Buffer.from([...CMD.tamanho(false), ...CMD.negrito(false), ...CMD.alinhar(0), ...CMD.avancar(4), ...CMD.cortar]));
  return Buffer.concat(partes);
}

// ---------- envio para a impressora ----------
function enviarRede(bytes, ip, porta) {
  return new Promise((resolve, reject) => {
    const s = net.createConnection({ host: ip, port: Number(porta) || 9100 });
    s.setTimeout(10000);
    s.on("connect", () => s.end(bytes));
    s.on("close", (erro) => (erro ? reject(new Error("conexão encerrada com erro")) : resolve()));
    s.on("timeout", () => s.destroy(new Error(`sem resposta da impressora em ${ip}:${porta}`)));
    s.on("error", reject);
  });
}

function enviarWindows(bytes, nome) {
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), `pedido-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
    fs.writeFileSync(tmp, bytes);
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(PASTA, "imprimir-windows.ps1"), "-Impressora", nome, "-Arquivo", tmp],
      { timeout: 30000, windowsHide: true },
      (erro, _saida, saidaErro) => {
        fs.rm(tmp, { force: true }, () => {});
        if (erro) reject(new Error((saidaErro || erro.message).trim()));
        else resolve();
      },
    );
  });
}

// Impressora comum: manda as linhas para o imprimir-comum.ps1, que desenha o cupom pelo driver do Windows.
function enviarComum(linhas, nome) {
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), `pedido-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    fs.writeFileSync(tmp, JSON.stringify(linhas), "utf8");
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(PASTA, "imprimir-comum.ps1"), "-Impressora", nome, "-Arquivo", tmp],
      { timeout: 60000, windowsHide: true },
      (erro, _saida, saidaErro) => {
        fs.rm(tmp, { force: true }, () => {});
        if (erro) reject(new Error((saidaErro || erro.message).trim()));
        else resolve();
      },
    );
  });
}

function enviarArquivo(bytes, pasta, nome) {
  const destino = path.resolve(PASTA, pasta || "saida");
  fs.mkdirSync(destino, { recursive: true });
  fs.writeFileSync(path.join(destino, `${nome}.bin`), bytes);
  return Promise.resolve();
}

async function imprimir(imp, linhas, nome) {
  if (imp.tipo === "rede") return enviarRede(montarEscPos(linhas), imp.ip, imp.porta);
  if (imp.tipo === "arquivo") return enviarArquivo(montarEscPos(linhas), imp.pasta, nome);
  if (process.platform !== "win32") throw new Error(`O tipo "${imp.tipo}" só funciona no Windows. Use "rede" ou "arquivo".`);
  if (imp.tipo === "comum") return enviarComum(linhas, imp.nome);
  return enviarWindows(montarEscPos(linhas), imp.nome);
}

// ---------- conversa com o sistema ----------
async function chamar(config, caminho, opcoes = {}) {
  const r = await fetch(`${config.sistema}${caminho}`, {
    ...opcoes,
    headers: { Authorization: `Bearer ${config.chave}`, "Content-Type": "application/json", ...(opcoes.headers || {}) },
    signal: AbortSignal.timeout(15000),
  });
  if (r.status === 401) throw new Error("Chave de impressão recusada. Baixe o config.json de novo no painel.");
  if (!r.ok) throw new Error(`sistema respondeu ${r.status}`);
  return r.json();
}

function descrever(imp) {
  return imp.tipo === "rede" ? `rede ${imp.ip}:${imp.porta || 9100}` : imp.tipo === "arquivo" ? "arquivo" : `"${imp.nome}"${imp.tipo === "comum" ? " (impressora comum, A4)" : ""}`;
}

// Impressora em uso: a escolhida no painel, se houver; senão, a do config.json.
let impressoraAtual = "";
function impressoraEfetiva(config, doPainel) {
  const imp = doPainel ? { ...config.impressora, ...doPainel } : config.impressora;
  const copias = doPainel ? Math.max(1, Math.min(5, Number(doPainel.copias) || 1)) : config.copias;
  const descricao = `${descrever(imp)}${copias > 1 ? `, ${copias} vias` : ""}`;
  if (!impressoraAtual && doPainel) registrar(`Usando a impressora escolhida no painel: ${descricao}`);
  else if (impressoraAtual && descricao !== impressoraAtual) registrar(`Impressora trocada: ${descricao}`);
  impressoraAtual = descricao;
  return { imp, copias };
}

// Nomes das impressoras instaladas no Windows, para escolher no painel.
function listarImpressoras() {
  if (process.platform !== "win32") return Promise.resolve([]);
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-Command", "[Console]::OutputEncoding = [Text.Encoding]::UTF8; Get-Printer | Select-Object -ExpandProperty Name"],
      { timeout: 30000, windowsHide: true },
      (erro, saida) => resolve(erro ? [] : String(saida).split(/\r?\n/).map((n) => n.trim()).filter(Boolean)),
    );
  });
}

async function informarImpressoras(config) {
  try {
    const impressoras = await listarImpressoras();
    await chamar(config, "/api/impressao/impressoras", { method: "POST", body: JSON.stringify({ computador: os.hostname(), impressoras }) });
  } catch {
    // sem conexão agora: tenta de novo na próxima rodada
  }
}

async function ciclo(config) {
  const resposta = await chamar(config, "/api/impressao/pendentes");
  const { imp, copias } = impressoraEfetiva(config, resposta.impressora);
  if (resposta.teste) {
    await paginaDeTeste(imp);
    await chamar(config, "/api/impressao/confirmar", { method: "POST", body: JSON.stringify({ teste: true }) });
  }
  for (const p of resposta.pedidos) {
    for (let c = 1; c <= copias; c++) await imprimir(imp, p.linhas, `pedido-${p.numero}${copias > 1 ? `-via${c}` : ""}`);
    await chamar(config, "/api/impressao/confirmar", { method: "POST", body: JSON.stringify({ id: p.id }) });
    registrar(`Pedido nº ${p.numero} impresso${copias > 1 ? ` (${copias} vias)` : ""}.`);
  }
}

async function paginaDeTeste(imp) {
  const linhas = [
    { texto: "TESTE DE IMPRESSÃO", grande: true, centro: true },
    { texto: new Date().toLocaleString("pt-BR"), centro: true },
    { texto: "-".repeat(48) },
    { texto: "Acentos: ação, pão, café, maçã, avó, Ñ, Ü" },
    { texto: "Negrito: R$ 1.234,56", negrito: true },
    { texto: "123456789012345678901234567890123456789012345678" },
    { texto: "-".repeat(48) },
    { texto: "Se esta folha saiu certa, a impressora está pronta.", centro: true },
  ];
  await imprimir(imp, linhas, "teste");
  registrar("Página de teste enviada para a impressora.");
}

async function principal() {
  const config = lerConfig();
  if (process.argv.includes("teste")) return paginaDeTeste(config.impressora);

  registrar(`Programa de impressão iniciado. Sistema: ${config.sistema} · Impressora do config.json: ${descrever(config.impressora)}`);
  await informarImpressoras(config);
  let ultimaLista = Date.now();
  let falhas = 0;
  for (;;) {
    try {
      if (Date.now() - ultimaLista > 10 * 60_000) {
        ultimaLista = Date.now();
        await informarImpressoras(config);
      }
      await ciclo(config);
      if (falhas) registrar("Conexão restabelecida.");
      falhas = 0;
    } catch (e) {
      falhas++;
      // Registra a primeira falha e depois só de vez em quando, para o log não crescer à toa.
      if (falhas === 1 || falhas % 60 === 0) registrar(`Erro: ${e.message}. Tentando de novo…`);
    }
    // Com falhas seguidas, espera um pouco mais (até 1 minuto).
    const espera = Math.min(60, config.intervaloSegundos * (falhas ? Math.min(falhas, 6) : 1));
    await new Promise((r) => setTimeout(r, espera * 1000));
  }
}

if (require.main === module) {
  principal().catch((e) => {
    registrar(`Erro: ${e.message}`);
    process.exitCode = 1;
  });
}

module.exports = { montarEscPos, paraBytes };
