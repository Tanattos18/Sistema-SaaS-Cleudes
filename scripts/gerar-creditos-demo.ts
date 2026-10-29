import { readFileSync, writeFileSync } from "node:fs";

/** Página de créditos das fotos para a demonstração estática. Uso: npm run pages:catalogo */
type Credito = { arquivo: string; autor: string; licenca: string; pagina: string };
const creditos: Record<string, Credito> = JSON.parse(readFileSync("public/produtos/creditos.json", "utf8"));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const linhas = Object.entries(creditos)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([slug, c]) => `<tr><td><img src="../public/produtos/${slug}.webp" alt="" width="64" height="48" loading="lazy"></td><td><a href="${esc(c.pagina)}" target="_blank" rel="noopener">${esc(c.arquivo)}</a></td><td>${esc(c.autor)}</td><td>${esc(c.licenca)}</td></tr>`)
  .join("\n");
writeFileSync(
  "site-demo/creditos.html",
  `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Créditos das imagens</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #f4f5f9; color: #111827; }
  main { max-width: 960px; margin: 0 auto; padding: 32px 16px; }
  h1 { color: #0f2557; margin: 0 0 8px; } p { color: #4b5563; font-size: 14px; }
  .tabela { overflow-x: auto; background: #fff; border-radius: 16px; box-shadow: 0 1px 3px rgb(0 0 0 / .1); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; background: #f9fafb; padding: 8px 12px; color: #6b7280; font-size: 11px; text-transform: uppercase; }
  td { padding: 8px 12px; border-top: 1px solid #f0f0f0; vertical-align: middle; }
  img { border-radius: 6px; object-fit: cover; display: block; } a { color: #1d3f94; word-break: break-all; }
</style>
</head>
<body><main>
<p><a href="./">← Voltar à loja</a></p>
<h1>Créditos das imagens</h1>
<p>As fotos dos produtos de demonstração vêm do Wikimedia Commons, com licenças livres. Clique no arquivo para ver a página original, o autor e a licença.</p>
<div class="tabela"><table><thead><tr><th>Foto</th><th>Arquivo</th><th>Autor</th><th>Licença</th></tr></thead><tbody>
${linhas}
</tbody></table></div>
</main></body>
</html>
`,
);
console.log(`site-demo/creditos.html: ${Object.keys(creditos).length} créditos.`);
