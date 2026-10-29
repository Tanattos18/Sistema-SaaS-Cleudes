import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, lerSessao } from "@/lib/sessao";

// Primeira barreira do painel: sem sessão válida, vai para o login.
// A vitrine (/{loja}) é pública. A checagem definitiva acontece em exigirUsuario().
export async function proxy(request: NextRequest) {
  const sessao = await lerSessao(request.cookies.get(COOKIE_SESSAO)?.value);
  if (!sessao) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*", "/trocar-senha"],
};
