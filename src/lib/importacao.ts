import { centavos } from "./formato";

/** Uma linha da planilha já validada. */
export type LinhaProduto = {
  linha: number;
  codigo: string | null;
  nome: string;
  categoria: string;
  preco: number;
  unidade: "un" | "kg";
  precoDe: number | null;
  precoVasilhame: number | null;
  disponivel: boolean;
  descricao: string | null;
};

export type ResultadoLeitura = { linhas: LinhaProduto[]; erros: string[] };

export const MAX_LINHAS_IMPORTACAO = 5000;

/** Colunas aceitas (cabeçalho sem acento, minúsculo) → campo. Vários nomes para a mesma coluna. */
const COLUNAS: Record<string, keyof Omit<LinhaProduto, "linha">> = {
  codigo: "codigo", cod: "codigo", sku: "codigo", ean: "codigo", codigo_de_barras: "codigo",
  nome: "nome", produto: "nome", descricao_do_produto: "nome",
  categoria: "categoria", secao: "categoria", departamento: "categoria", grupo: "categoria",
  preco: "preco", preco_venda: "preco", valor: "preco", preco_atual: "preco", preco_por: "preco",
  unidade: "unidade", un: "unidade", tipo: "unidade",
  preco_de: "precoDe", de: "precoDe", preco_antigo: "precoDe",
  preco_vasilhame: "precoVasilhame", vasilhame: "precoVasilhame",
  disponivel: "disponivel", ativo: "disponivel", estoque: "disponivel",
  descricao: "descricao", observacao: "descricao", detalhes: "descricao",
};

export function normalizarCabecalho(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** "R$ 1.234,56", "27,9", 27.9 → número; vazio → null; texto inválido → NaN. */
export function lerNumero(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  let s = String(v).replace(/R\$|\s/g, "");
  if (!s) return null;
  // Com vírgula, ela é o decimal e os pontos são milhar; só com ponto, ele é o decimal.
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

function lerUnidade(v: unknown): "un" | "kg" | null {
  const s = normalizarCabecalho(String(v ?? ""));
  if (!s) return "un";
  if (["kg", "quilo", "kilo", "quilograma", "peso", "granel"].includes(s)) return "kg";
  if (["un", "und", "unid", "unidade", "pc", "peca", "cx", "pct", "pacote", "fardo", "lata", "garrafa"].includes(s)) return "un";
  return null;
}

function lerSimNao(v: unknown): boolean | null {
  if (v == null || v === "") return true;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v > 0;
  const s = normalizarCabecalho(String(v));
  if (["sim", "s", "1", "true", "verdadeiro", "x", "disponivel", "ativo"].includes(s)) return true;
  if (["nao", "n", "0", "false", "falso", "indisponivel", "inativo", "esgotado"].includes(s)) return false;
  return null;
}

const texto = (v: unknown) => {
  const s = v == null ? "" : String(v).trim();
  return s || null;
};

/**
 * Valida as linhas da planilha (primeira linha = cabeçalho). Junta todos os erros para o lojista
 * corrigir de uma vez; se houver qualquer erro, nada deve ser gravado.
 */
export function lerPlanilha(tabela: unknown[][]): ResultadoLeitura {
  const erros: string[] = [];
  if (tabela.length < 2) return { linhas: [], erros: ["A planilha está vazia: precisa do cabeçalho e de pelo menos um produto."] };

  const cabecalho = tabela[0].map((c) => COLUNAS[normalizarCabecalho(String(c ?? ""))]);
  for (const obrigatoria of ["nome", "categoria", "preco"] as const) {
    if (!cabecalho.includes(obrigatoria)) erros.push(`Falta a coluna "${obrigatoria === "preco" ? "preço" : obrigatoria}" no cabeçalho.`);
  }
  if (erros.length) return { linhas: [], erros };

  const corpo = tabela.slice(1);
  if (corpo.length > MAX_LINHAS_IMPORTACAO) return { linhas: [], erros: [`Planilha com mais de ${MAX_LINHAS_IMPORTACAO} linhas. Divida em partes.`] };

  const linhas: LinhaProduto[] = [];
  const codigos = new Map<string, number>();
  corpo.forEach((celulas, i) => {
    const n = i + 2; // número da linha como o Excel mostra
    const v: Partial<Record<keyof Omit<LinhaProduto, "linha">, unknown>> = {};
    cabecalho.forEach((campo, j) => {
      if (campo && v[campo] === undefined) v[campo] = celulas[j];
    });
    if (celulas.every((c) => c == null || String(c).trim() === "")) return; // linha em branco

    const problemas: string[] = [];
    const nome = texto(v.nome);
    const categoria = texto(v.categoria);
    const preco = lerNumero(v.preco);
    const precoDe = lerNumero(v.precoDe);
    const precoVasilhame = lerNumero(v.precoVasilhame);
    const unidade = lerUnidade(v.unidade);
    const disponivel = lerSimNao(v.disponivel);
    const codigo = texto(v.codigo);

    if (!nome || nome.length < 2) problemas.push("nome vazio");
    else if (nome.length > 120) problemas.push("nome com mais de 120 letras");
    if (!categoria) problemas.push("categoria vazia");
    if (preco == null || Number.isNaN(preco) || preco <= 0) problemas.push("preço inválido");
    if (precoDe != null && (Number.isNaN(precoDe) || (preco != null && precoDe <= preco))) problemas.push("preço “de” precisa ser maior que o preço");
    if (precoVasilhame != null && (Number.isNaN(precoVasilhame) || precoVasilhame < 0)) problemas.push("preço do vasilhame inválido");
    if (!unidade) problemas.push(`unidade "${v.unidade}" não reconhecida (use un ou kg)`);
    if (unidade === "kg" && precoVasilhame) problemas.push("produto por quilo não tem vasilhame");
    if (disponivel == null) problemas.push(`disponível "${v.disponivel}" não reconhecido (use sim ou não)`);
    if (codigo) {
      if (codigos.has(codigo)) problemas.push(`código ${codigo} repetido (já está na linha ${codigos.get(codigo)})`);
      else codigos.set(codigo, n);
    }

    if (problemas.length) {
      erros.push(`Linha ${n}${nome ? ` (${nome})` : ""}: ${problemas.join("; ")}.`);
      return;
    }
    linhas.push({
      linha: n,
      codigo,
      nome: nome!,
      categoria: categoria!.slice(0, 60),
      preco: centavos(preco!),
      unidade: unidade!,
      precoDe: precoDe != null ? centavos(precoDe) : null,
      precoVasilhame: precoVasilhame ? centavos(precoVasilhame) : null,
      disponivel: disponivel!,
      descricao: texto(v.descricao)?.slice(0, 500) ?? null,
    });
  });
  if (!linhas.length && !erros.length) erros.push("Nenhum produto encontrado na planilha.");
  return { linhas, erros };
}

/** CSV exportado pelo Excel em português (ponto e vírgula) ou internacional (vírgula), com aspas. */
export function lerCsv(conteudo: string): string[][] {
  const texto = conteudo.replace(/^﻿/, "");
  const primeira = texto.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = "";
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}
