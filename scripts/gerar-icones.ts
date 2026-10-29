import { mkdirSync } from "node:fs";
import sharp from "sharp";

/** Ícones do aplicativo (PWA) nas cores da fachada. Uso: npx tsx scripts/gerar-icones.ts */
const svg = (margem: number) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${margem ? 0 : 112}" fill="#ffd200"/>
  <g transform="translate(256 256) scale(${margem ? 0.78 : 1}) translate(-256 -256)">
    <rect x="96" y="96" width="320" height="320" rx="88" fill="#1d3f94"/>
    <path d="M318 196a96 96 0 1 0 0 120" fill="none" stroke="#ffd200" stroke-width="58" stroke-linecap="round"/>
    <circle cx="372" cy="140" r="34" fill="#e3141b"/>
  </g>
</svg>`;

async function main() {
  mkdirSync("public/icones", { recursive: true });
  const normal = Buffer.from(svg(0));
  const mascaravel = Buffer.from(svg(1));
  await sharp(normal).resize(192).png().toFile("public/icones/icone-192.png");
  await sharp(normal).resize(512).png().toFile("public/icones/icone-512.png");
  await sharp(mascaravel).resize(512).png().toFile("public/icones/icone-maskable-512.png");
  await sharp(mascaravel).resize(180).png().toFile("public/icones/apple-touch-icon.png");
  await sharp(normal).resize(48).png().toFile("src/app/icon.png");
  console.log("Ícones gerados em public/icones.");
}
main();
