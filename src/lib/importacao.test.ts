import { describe, expect, it } from "vitest";
import { lerCsv, lerNumero, lerPlanilha } from "./importacao";

describe("leitura da planilha de produtos", () => {
  it("aceita cabeçalhos com acento e nomes alternativos", () => {
    const r = lerPlanilha([
      ["Código", "Produto", "Seção", "Preço", "Unidade", "Preço de", "Vasilhame", "Disponível"],
      ["789", "Arroz 5kg", "Mercearia", "R$ 27,90", "UN", "31,90", "", "sim"],
      ["", "Picanha", "Açougue", 79.9, "kg", "", "", ""],
      ["G13", "Gás P13", "Gás", "120", "", "", "180,00", "não"],
    ]);
    expect(r.erros).toEqual([]);
    expect(r.linhas).toMatchObject([
      { linha: 2, codigo: "789", nome: "Arroz 5kg", categoria: "Mercearia", preco: 27.9, unidade: "un", precoDe: 31.9, disponivel: true },
      { linha: 3, codigo: null, unidade: "kg", preco: 79.9, disponivel: true },
      { linha: 4, precoVasilhame: 180, disponivel: false },
    ]);
  });

  it("junta todos os erros com o número da linha do Excel", () => {
    const r = lerPlanilha([
      ["codigo", "nome", "categoria", "preco", "unidade"],
      ["1", "Feijão", "Mercearia", "abc", "un"],
      ["1", "Café", "", "10", "litro"],
      ["", "", "", "", ""],
      ["2", "Açúcar", "Mercearia", "5", "un"],
    ]);
    expect(r.linhas).toHaveLength(1);
    expect(r.erros).toEqual([
      "Linha 2 (Feijão): preço inválido.",
      'Linha 3 (Café): categoria vazia; unidade "litro" não reconhecida (use un ou kg); código 1 repetido (já está na linha 2).',
    ]);
  });

  it("exige as colunas nome, categoria e preço", () => {
    expect(lerPlanilha([["nome", "valor"], ["x", "1"]]).erros).toEqual(['Falta a coluna "categoria" no cabeçalho.']);
    expect(lerPlanilha([["nome"]]).erros[0]).toMatch(/vazia/);
  });

  it("recusa preço 'de' menor que o preço e vasilhame em produto por quilo", () => {
    const r = lerPlanilha([
      ["nome", "categoria", "preco", "preco_de", "unidade", "vasilhame"],
      ["Carne", "Açougue", "40", "30", "kg", "10"],
    ]);
    expect(r.erros[0]).toMatch(/preço “de”.*vasilhame/);
  });
});

describe("números e CSV", () => {
  it("entende o formato brasileiro", () => {
    expect(lerNumero("R$ 1.234,56")).toBe(1234.56);
    expect(lerNumero("27.9")).toBe(27.9);
    expect(lerNumero("")).toBeNull();
    expect(lerNumero("dez")).toBeNaN();
  });

  it("lê CSV com ponto e vírgula, aspas e quebra de linha do Windows", () => {
    expect(lerCsv('﻿nome;categoria;preco\r\n"Biscoito ""recheado""";Doces;"2,99"\r\nSal;Mercearia;2,49\r\n')).toEqual([
      ["nome", "categoria", "preco"],
      ['Biscoito "recheado"', "Doces", "2,99"],
      ["Sal", "Mercearia", "2,49"],
    ]);
    expect(lerCsv("nome,categoria,preco\nSal,Mercearia,2.49")).toEqual([["nome", "categoria", "preco"], ["Sal", "Mercearia", "2.49"]]);
  });
});
