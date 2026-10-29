import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { sair } from "../login/actions";

const MENU = [
  { href: "/painel", rotulo: "Pedidos" },
];

export default async function PainelLayout({ children }: LayoutProps<"/painel">) {
  const usuario = await exigirUsuario();
  const db = await getDb();
  const [loja] = await db.select({ nome: schema.lojas.nome, slug: schema.lojas.slug }).from(schema.lojas).where(eq(schema.lojas.id, usuario.lojaId));

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-gray-200 bg-white md:w-56 md:shrink-0 md:border-r md:border-b-0">
        <div className="px-5 py-4">
          <Link href="/painel" className="text-lg font-semibold text-blue-900">{loja?.nome}</Link>
          <p className="text-xs text-gray-500">{usuario.nome}</p>
        </div>
        <nav className="flex gap-4 overflow-x-auto px-3 pb-4 md:block md:space-y-1">
          {MENU.map((i) => (
            <Link key={i.href} href={i.href} className="block min-w-max rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-900">
              {i.rotulo}
            </Link>
          ))}
          {loja && (
            <a href={`/${loja.slug}`} target="_blank" rel="noopener" className="block min-w-max rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-blue-50">
              Ver vitrine ↗
            </a>
          )}
          <form action={sair} className="min-w-max px-2 pt-2">
            <button className="text-sm text-gray-500 hover:text-red-700">Sair</button>
          </form>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
