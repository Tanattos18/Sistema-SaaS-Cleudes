"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { auditar } from "@/lib/auditoria";
import { exigirUsuario } from "@/lib/auth";
import { hojeISO } from "@/lib/formato";
import { lerCsv, lerPlanilha } from "@/lib/importacao";
import { importarProdutos, type ResumoImportacao } from "@/lib/importar-produtos";

export type EstadoImportacao = { erros?: string[]; resumo?: ResumoImportacao; vigenteEm?: string | null };

const MAX_BYTES = 5 * 1024 * 1024;

async function tabelaDoArquivo(arquivo: File): Promise<unknown[][]> {
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith(".csv") || nome.endsWith(".txt")) {
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    // Excel em português costuma salvar CSV em Windows-1252; se não for UTF-8 válido, tenta esse.
    let texto: string;
    try {
      texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      texto = new TextDecoder("windows-1252").decode(bytes);
    }
    return lerCsv(texto);
  }
  const ExcelJS = (await import("exceljs")).default;
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(await arquivo.arrayBuffer());
  const aba = livro.worksheets.find((w) => w.rowCount > 0);
  if (!aba) return [];
  const linhas: unknown[][] = [];
  aba.eachRow({ includeEmpty: true }, (row) => {
    const valores = (row.values as unknown[]).slice(1).map((v) => {
      if (v && typeof v === "object") {
        const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
        if (o.result !== undefined) return o.result; // fórmula
        if (o.richText) return o.richText.map((t) => t.text).join("");
        if (o.text !== undefined) return o.text; // link
      }
      return v;
    });
    linhas.push(valores);
  });
  return linhas;
}

export async function importarPlanilha(_: EstadoImportacao, formData: FormData): Promise<EstadoImportacao> {
  const usuario = await exigirUsuario();
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erros: ["Escolha o arquivo da planilha."] };
  if (arquivo.size > MAX_BYTES) return { erros: ["Arquivo maior que 5 MB."] };
  if (!/\.(xlsx|csv|txt)$/i.test(arquivo.name)) return { erros: ["Use uma planilha do Excel (.xlsx) ou um arquivo .csv."] };
  const data = formData.get("quando") === "data" ? String(formData.get("vigenteEm") ?? "") : "";
  const vigenteEm = /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null;
  if (vigenteEm && vigenteEm < hojeISO()) return { erros: ["A data dos preços não pode ser no passado."] };

  let tabela: unknown[][];
  try {
    tabela = await tabelaDoArquivo(arquivo);
  } catch {
    return { erros: ["Não foi possível ler o arquivo. Salve de novo como .xlsx ou .csv e tente outra vez."] };
  }
  const { linhas, erros } = lerPlanilha(tabela);
  if (erros.length) return { erros };

  const db = await getDb();
  const resumo = await importarProdutos(db, usuario.lojaId, usuario.uid, linhas, vigenteEm);
  await auditar(db, usuario.lojaId, usuario.uid, "importar", "produto", null, { arquivo: arquivo.name, vigenteEm, ...resumo });
  revalidatePath("/painel/produtos");
  return { resumo, vigenteEm };
}
