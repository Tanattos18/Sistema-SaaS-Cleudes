import { getDb } from "@/db";
import { lojaPorSlug } from "@/lib/loja";

/** Manifesto do aplicativo de cada loja: instalado, abre direto na vitrine dela. */
export async function GET(_: Request, { params }: RouteContext<"/[loja]/manifest.webmanifest">) {
  const { loja: slug } = await params;
  const loja = await lojaPorSlug(await getDb(), slug);
  if (!loja) return new Response("Loja não encontrada", { status: 404 });
  const manifesto = {
    id: `/${loja.slug}`,
    name: loja.nome,
    short_name: loja.nome.split(" ").at(-1),
    description: loja.mensagemBoasVindas ?? `Faça seu pedido no ${loja.nome}`,
    start_url: `/${loja.slug}`,
    scope: `/${loja.slug}`,
    display: "standalone",
    orientation: "any",
    background_color: "#f4f5f9",
    theme_color: "#ffd200",
    lang: "pt-BR",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return Response.json(manifesto, { headers: { "Content-Type": "application/manifest+json; charset=utf-8" } });
}
