import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { sair } from "../login/actions";

const MENU = [
  { titulo: "Loja", itens: [
    { href: "/painel", rotulo: "Pedidos" },
  ]},
  { titulo: "Catálogo", itens: [
    { href: "/painel/produtos", rotulo: "Produtos" },
    { href: "/painel/produtos/novo", rotulo: "+ Novo produto" },
    { href: "/painel/precos", rotulo: "Preços e promoções" },
    { href: "/painel/categorias", rotulo: "Categorias" },
    { href: "/painel/produtos/importar", rotulo: "Importar planilha" },
  ]},
];

const MENU_ADMIN = { titulo: "Administração", itens: [
  { href: "/painel/configuracoes", rotulo: "Configurações da loja" },
  { href: "/painel/usuarios", rotulo: "Usuários" },
]};

export default async function PainelLayout({ children }: LayoutProps<"/painel">) {
  const usuario = await exigirUsuario();
  const db = await getDb();
  const [loja] = await db.select({ nome: schema.lojas.nome, slug: schema.lojas.slug }).from(schema.lojas).where(eq(schema.lojas.id, usuario.lojaId));
  const grupos = usuario.perfil === "admin" ? [...MENU, MENU_ADMIN] : MENU;

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f5f9] md:flex-row print:bg-white">
      <aside className="bg-marca-azul-escuro text-blue-100 print:hidden md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto">
        <div className="flex items-center gap-3 px-5 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marca-amarelo font-titulos text-2xl font-extrabold text-marca-azul-escuro">{loja?.nome.split(" ").at(-1)?.[0]}</span>
          <div className="min-w-0">
            <Link href="/painel" className="block truncate font-titulos text-lg leading-tight font-bold text-white">{loja?.nome}</Link>
            <p className="truncate text-xs text-blue-200">{usuario.nome} · {usuario.perfil === "admin" ? "Administrador" : "Operador"}</p>
          </div>
        </div>
        <nav className="flex gap-6 overflow-x-auto px-3 pb-4 md:block md:space-y-5">
          {grupos.map((g) => (
            <div key={g.titulo} className="min-w-max">
              <p className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-blue-300/70 uppercase">{g.titulo}</p>
              {g.itens.map((i) => (
                <Link key={i.href} href={i.href} className="block rounded-md px-2 py-1.5 text-sm hover:bg-white/10 hover:text-white">
                  {i.rotulo}
                </Link>
              ))}
            </div>
          ))}
          <div className="min-w-max space-y-0.5 border-white/10 md:border-t md:pt-4">
            {loja && (
              <a href={`/${loja.slug}`} target="_blank" rel="noopener" className="block rounded-md px-2 py-1.5 text-sm font-semibold text-marca-amarelo hover:bg-white/10">
                Ver a loja ↗
              </a>
            )}
            <Link href="/painel/conta" className="block rounded-md px-2 py-1.5 text-sm hover:bg-white/10">Minha senha</Link>
            <form action={sair}>
              <button className="w-full rounded-md px-2 py-1.5 text-left text-sm text-blue-200 hover:bg-white/10 hover:text-red-300">Sair</button>
            </form>
          </div>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8 print:p-0">{children}</main>
    </div>
  );
}
