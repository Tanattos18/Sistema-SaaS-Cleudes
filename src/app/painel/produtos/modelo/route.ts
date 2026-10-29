import { usuarioAutorizado } from "@/lib/auth";

/** Planilha modelo para a importação de produtos, com exemplos e instruções. */
export async function GET() {
  if (!(await usuarioAutorizado())) return new Response("Faça login no painel.", { status: 401 });
  const ExcelJS = (await import("exceljs")).default;
  const livro = new ExcelJS.Workbook();
  const aba = livro.addWorksheet("Produtos");
  aba.columns = [
    { header: "codigo", key: "codigo", width: 16 },
    { header: "nome", key: "nome", width: 40 },
    { header: "categoria", key: "categoria", width: 20 },
    { header: "preco", key: "preco", width: 12 },
    { header: "unidade", key: "unidade", width: 10 },
    { header: "preco_de", key: "preco_de", width: 12 },
    { header: "vasilhame", key: "vasilhame", width: 12 },
    { header: "disponivel", key: "disponivel", width: 12 },
  ];
  aba.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  aba.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D3F94" } };
  aba.addRows([
    { codigo: "7891234567890", nome: "Arroz tipo 1 5kg", categoria: "Mercearia", preco: 27.9, unidade: "un", disponivel: "sim" },
    { codigo: "1001", nome: "Carne moída de primeira", categoria: "Açougue", preco: 39.9, unidade: "kg", preco_de: 44.9, disponivel: "sim" },
    { codigo: "2001", nome: "Gás de cozinha P13 (13 kg)", categoria: "Gás e Água", preco: 120, unidade: "un", vasilhame: 180, disponivel: "sim" },
  ]);
  for (const c of ["preco", "preco_de", "vasilhame"]) aba.getColumn(c).numFmt = '"R$" #,##0.00';
  aba.views = [{ state: "frozen", ySplit: 1 }];

  const ajuda = livro.addWorksheet("Instruções");
  ajuda.getColumn(1).width = 110;
  [
    "Preencha a aba Produtos: uma linha por produto. Não mude os nomes da primeira linha.",
    "nome, categoria e preco são obrigatórios. Categorias que não existem são criadas.",
    "codigo: use o código do caixa ou de barras. É por ele que o sistema acha o produto ao atualizar.",
    "unidade: un (unidade) ou kg (vendido por quilo; o cliente pede pelo valor, ex.: R$ 20 de carne).",
    "preco_de: preço antigo, aparece riscado na loja (promoção). Precisa ser maior que o preco.",
    "vasilhame: só para gás e galão de água: valor cobrado de quem não tem o vazio para troca.",
    "disponivel: sim ou não. Use não quando o produto está em falta.",
    "Para os preços valerem só amanhã, importe hoje e escolha a data em “Quando os preços novos valem”.",
  ].forEach((t) => ajuda.addRow([t]));

  const buffer = await livro.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-produtos.xlsx"',
    },
  });
}
