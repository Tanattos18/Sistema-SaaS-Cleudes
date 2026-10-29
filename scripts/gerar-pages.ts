import { writeFileSync } from "node:fs";
import { CATALOGO } from "./catalogo-demo";

/**
 * Gera pages/catalogo.json para a demonstração estática (GitHub Pages).
 * Uso: npm run pages:catalogo
 */
let id = 0;
const categorias = CATALOGO.map((c, i) => ({ id: i + 1, nome: c.nome, icone: c.icone }));
const produtos = CATALOGO.flatMap((c, i) =>
  c.itens.map(([nome, preco, extra]) => ({
    id: ++id,
    categoriaId: i + 1,
    nome,
    unidade: extra?.kg ? "kg" : "un",
    preco: Math.round(preco * 100) / 100,
    precoDe: extra?.de ?? null,
    precoVasilhame: extra?.vasilhame ?? null,
  })),
);
writeFileSync("pages/catalogo.json", JSON.stringify({ categorias, produtos }));
console.log(`pages/catalogo.json: ${produtos.length} produtos em ${categorias.length} categorias.`);
