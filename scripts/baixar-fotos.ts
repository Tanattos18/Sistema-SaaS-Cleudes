import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { CATALOGO } from "./catalogo-demo";
import { FOTOS, fotoDoProduto } from "./fotos-demo";

/**
 * Baixa a imagem principal do artigo da Wikipédia de cada grupo de produtos de demonstração
 * (só imagens de licença livre, hospedadas no Wikimedia Commons), recorta em 4:3, grava em WebP
 * e registra os créditos exigidos pelas licenças.
 * Uso: npm run fotos:baixar                 (só as que faltam)
 *      npm run fotos:baixar -- banana gas   (refaz essas)
 */

const PASTA = "public/produtos";
const CREDITOS = `${PASTA}/creditos.json`;
const UA = "SistemaPedidosDemo/0.1 (https://github.com/Tanattos18/Sistema-SaaS-Cleudes)";

/** Arquivo do Commons escolhido à mão quando a imagem do artigo não serve como foto de produto. */
const FIXOS: Record<string, string> = {};

type Credito = { arquivo: string; autor: string; licenca: string; pagina: string };

const semHtml = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function api(host: string, params: Record<string, string>) {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (r.ok) return r.json();
    await new Promise((ok) => setTimeout(ok, 2000 * (tentativa + 1)));
  }
  throw new Error(`${host} não respondeu`);
}

/** Nome do arquivo da imagem principal de cada artigo, consultando 50 títulos por vez. */
async function imagensDosArtigos(titulos: string[], idioma: string): Promise<Map<string, string>> {
  const r = new Map<string, string>();
  for (let i = 0; i < titulos.length; i += 50) {
    const lote = titulos.slice(i, i + 50);
    const d = await api(`${idioma}.wikipedia.org`, {
      action: "query", prop: "pageimages", piprop: "name", pilicense: "free", redirects: "1", titles: lote.join("|"),
    });
    // Mapeia o título pedido → título final (normalização e redirecionamentos).
    const final = new Map<string, string>(lote.map((t) => [t, t]));
    for (const n of d.query?.normalized ?? []) for (const [k, v] of final) if (v === n.from) final.set(k, n.to);
    for (const n of d.query?.redirects ?? []) for (const [k, v] of final) if (v === n.from) final.set(k, n.to);
    const imagem = new Map<string, string>((d.query?.pages ?? []).filter((p: { pageimage?: string }) => p.pageimage).map((p: { title: string; pageimage: string }) => [p.title, p.pageimage]));
    for (const [pedido, titulo] of final) if (imagem.has(titulo)) r.set(pedido, imagem.get(titulo)!);
  }
  return r;
}

const ruim = /logo|svg|map|diagram|icon|drawing|illustration|chart|label|stamp|coat of arms|flag|poster|screenshot|text|botanical|köhler/i;

/** Primeira foto aceitável de uma busca no Commons: bitmap, grande, sem cara de desenho ou logotipo. */
async function buscarNoCommons(busca: string): Promise<string | undefined> {
  const d = await api("commons.wikimedia.org", {
    action: "query", generator: "search", gsrnamespace: "6", gsrsearch: `${busca} filetype:bitmap`, gsrlimit: "20",
    prop: "imageinfo", iiprop: "size|mime",
  });
  type P = { title: string; index: number; imageinfo?: { width: number; height: number; mime: string }[] };
  const p = ((d.query?.pages ?? []) as P[])
    .sort((a, b) => a.index - b.index)
    .find((p) => {
      const i = p.imageinfo?.[0];
      return i && /jpeg|png/.test(i.mime) && !ruim.test(p.title) && i.width >= 600 && i.width / i.height > 0.75 && i.width / i.height < 1.9;
    });
  return p?.title.replace(/^File:/, "");
}

async function baixar(slug: string, arquivo: string): Promise<Credito> {
  const d = await api("commons.wikimedia.org", {
    action: "query", titles: `File:${arquivo}`, prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "800",
    iiextmetadatafilter: "Artist|LicenseShortName",
  });
  const i = d.query?.pages?.[0]?.imageinfo?.[0];
  if (!i) throw new Error(`arquivo ${arquivo} não encontrado no Commons`);
  const img = await fetch(i.thumburl, { headers: { "User-Agent": UA } });
  if (!img.ok) throw new Error(`falha ao baixar ${arquivo} (${img.status})`);
  // Mesmo formato para todas: 4:3, 480×360, recorte pelo centro de interesse.
  await sharp(Buffer.from(await img.arrayBuffer()))
    .resize(480, 360, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 72 })
    .toFile(`${PASTA}/${slug}.webp`);
  const meta = i.extmetadata ?? {};
  return {
    arquivo,
    autor: semHtml(meta.Artist?.value ?? "desconhecido"),
    licenca: meta.LicenseShortName?.value ?? "ver página",
    pagina: i.descriptionurl,
  };
}

async function main() {
  mkdirSync(PASTA, { recursive: true });
  const creditos: Record<string, Credito> = existsSync(CREDITOS) ? JSON.parse(readFileSync(CREDITOS, "utf8")) : {};
  const refazer = new Set(process.argv.slice(2));

  const semFoto = CATALOGO.flatMap((c) => c.itens.map((i) => i[0])).filter((n) => !fotoDoProduto(n));
  if (semFoto.length) console.log(`Produtos sem regra de foto (${semFoto.length}): ${semFoto.join(", ")}`);

  const grupos = new Map<string, string>();
  for (const [, slug, artigo] of FOTOS) if (!grupos.has(slug)) grupos.set(slug, artigo);
  const fila = [...grupos].filter(([slug]) => refazer.has(slug) || !existsSync(`${PASTA}/${slug}.webp`));
  console.log(`${grupos.size} fotos no total; baixando ${fila.length}.`);

  const arquivos = new Map<string, string>();
  for (const [slug, a] of fila) {
    if (FIXOS[slug] || !a.startsWith("busca:")) continue;
    const f = await buscarNoCommons(a.slice(6));
    if (f) arquivos.set(slug, f);
  }
  for (const idioma of ["en", "pt"]) {
    const doIdioma = fila.filter(([slug, a]) => !FIXOS[slug] && !a.startsWith("busca:") && (idioma === "pt") === a.startsWith("pt:"));
    const achados = await imagensDosArtigos(doIdioma.map(([, a]) => a.replace(/^pt:/, "")), idioma);
    for (const [slug, a] of doIdioma) {
      const f = achados.get(a.replace(/^pt:/, ""));
      if (f) arquivos.set(slug, f);
    }
  }
  for (const [slug, f] of Object.entries(FIXOS)) if (fila.some(([s]) => s === slug)) arquivos.set(slug, f.replace(/^File:/, ""));

  const falhas = fila.filter(([slug]) => !arquivos.has(slug)).map(([slug, a]) => `${slug}: o artigo "${a}" não tem imagem livre`);
  const pendentes = fila.filter(([slug]) => arquivos.has(slug));
  // Poucas requisições simultâneas, por educação com a API pública.
  for (let i = 0; i < pendentes.length; i += 4) {
    await Promise.all(
      pendentes.slice(i, i + 4).map(async ([slug]) => {
        try {
          creditos[slug] = await baixar(slug, arquivos.get(slug)!);
        } catch (e) {
          falhas.push(`${slug}: ${(e as Error).message}`);
        }
      }),
    );
    process.stdout.write(".");
  }
  writeFileSync(CREDITOS, JSON.stringify(creditos, null, 2));
  console.log(`\n${Object.keys(creditos).length} fotos com crédito em ${CREDITOS}.`);
  if (falhas.length) console.log(`Falhas:\n${falhas.join("\n")}`);
}

main();
