import { writeFileSync } from "node:fs";
import { CATALOGO, PROMOCOES } from "./catalogo-demo";
import { fotoDoProduto } from "./fotos-demo";

/**
 * Gera site-demo/catalogo.json para a demonstração estática (GitHub Pages).
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
    precoDe: extra?.de ?? PROMOCOES[nome] ?? null,
    foto: fotoDoProduto(nome),
    precoVasilhame: extra?.vasilhame ?? null,
  })),
);
writeFileSync("site-demo/catalogo.json", JSON.stringify({ categorias, produtos }));
console.log(`site-demo/catalogo.json: ${produtos.length} produtos em ${categorias.length} categorias.`);
