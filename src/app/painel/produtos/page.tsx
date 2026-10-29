import Link from "next/link";
import { and, asc, count, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { moeda } from "@/lib/formato";
import { Cabecalho, Vazio } from "@/components/ui";
import { alternarDisponivel } from "./actions";

export const metadata = { title: "Produtos — Painel" };

const POR_PAGINA = 50;

export default async function ProdutosPage({ searchParams }: PageProps<"/painel/produtos">) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  const busca = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const categoriaId = Number(sp.categoria) || null;
  const situacao = sp.situacao === "indisponivel" || sp.situacao === "inativo" ? sp.situacao : null;
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const db = await getDb();
  const P = schema.produtos;
  const filtros: SQL[] = [eq(P.lojaId, usuario.lojaId)];
  if (busca) filtros.push(or(ilike(P.nome, `%${busca}%`), ilike(P.codigo, `%${busca}%`))!);
  if (categoriaId) filtros.push(eq(P.categoriaId, categoriaId));
  filtros.push(eq(P.ativo, situacao !== "inativo"));
  if (situacao === "indisponivel") filtros.push(eq(P.disponivel, false));
  const onde = and(...filtros);

  const [categorias, [{ total }], lista, [{ agendados }]] = await Promise.all([
    db.select({ id: schema.categorias.id, nome: schema.categorias.nome }).from(schema.categorias).where(eq(schema.categorias.lojaId, usuario.lojaId)).orderBy(asc(schema.categorias.ordem)),
    db.select({ total: count() }).from(P).where(onde),
    db
      .select({ id: P.id, nome: P.nome, codigo: P.codigo, unidade: P.unidade, preco: P.preco, precoDe: P.precoDe, precoVasilhame: P.precoVasilhame, imagemUrl: P.imagemUrl, disponivel: P.disponivel, categoria: schema.categorias.nome })
      .from(P)
      .innerJoin(schema.categorias, eq(schema.categorias.id, P.categoriaId))
      .where(onde)
      .orderBy(asc(P.nome))
      .limit(POR_PAGINA)
      .offset((pagina - 1) * POR_PAGINA),
    db
      .select({ agendados: count() })
      .from(schema.precosAgendados)
      .innerJoin(P, eq(P.id, schema.precosAgendados.produtoId))
      .where(and(eq(P.lojaId, usuario.lojaId), isNull(schema.precosAgendados.aplicadoEm))),
  ]);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const link = (mudar: Record<string, string | number | null>) => {
    const q = new URLSearchParams();
    const atual = { q: busca, categoria: categoriaId, situacao, pagina, ...mudar };
    for (const [k, v] of Object.entries(atual)) if (v && !(k === "pagina" && v === 1)) q.set(k, String(v));
    return `/painel/produtos${q.size ? `?${q}` : ""}`;
  };

  return (
    <div>
      <Cabecalho
        titulo="Produtos"
        descricao={`${total} produto(s)${agendados ? ` · ${agendados} mudança(s) de preço agendada(s)` : ""}`}
        acoes={
          <>
            <Link href="/painel/precos" className="botao-sec">Preços agendados</Link>
            <Link href="/painel/produtos/importar" className="botao-sec">Importar planilha</Link>
            <Link href="/painel/produtos/novo" className="botao">Novo produto</Link>
          </>
        }
      />

      <form className="cartao mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_200px_180px_auto]" action="/painel/produtos">
        <input name="q" defaultValue={busca} placeholder="Buscar por nome ou código" className="campo" />
        <select name="categoria" defaultValue={categoriaId ?? ""} className="campo">
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select name="situacao" defaultValue={situacao ?? ""} className="campo">
          <option value="">À venda</option>
          <option value="indisponivel">Indisponíveis (em falta)</option>
          <option value="inativo">Fora do catálogo</option>
        </select>
        <button className="botao">Filtrar</button>
      </form>

      <div className="cartao overflow-x-auto p-0">
        {lista.length === 0 ? (
          <Vazio>Nenhum produto encontrado.</Vazio>
        ) : (
          <table className="tabela">
            <thead>
              <tr><th className="w-14" /><th>Produto</th><th>Categoria</th><th className="text-right">Preço</th><th className="text-center">Disponível</th></tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td>
                    <div className="size-10 overflow-hidden rounded-md bg-marca-amarelo-claro">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.imagemUrl && <img src={p.imagemUrl} alt="" width={40} height={40} loading="lazy" className="size-full object-cover" />}
                    </div>
                  </td>
                  <td>
                    <Link href={`/painel/produtos/${p.id}`} className="link">{p.nome}</Link>
                    <span className="block text-xs text-gray-500">
                      {p.codigo ? `Cód. ${p.codigo}` : "Sem código"}
                      {p.unidade === "kg" && " · vendido por kg"}
                      {p.precoVasilhame != null && ` · vasilhame ${moeda(p.precoVasilhame)}`}
                    </span>
                  </td>
                  <td className="text-gray-600">{p.categoria}</td>
                  <td className="text-right whitespace-nowrap">
                    {p.precoDe != null && <span className="block text-xs text-gray-400 line-through">{moeda(p.precoDe)}</span>}
                    <span className={`font-semibold ${p.precoDe != null ? "text-marca-vermelho" : ""}`}>{moeda(p.preco)}</span>
                    {p.unidade === "kg" && <span className="text-xs text-gray-500">/kg</span>}
                  </td>
                  <td className="text-center">
                    <form action={alternarDisponivel}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="disponivel" value={String(!p.disponivel)} />
                      <button
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${p.disponivel ? "bg-green-600" : "bg-gray-300"}`}
                        aria-label={p.disponivel ? `Marcar ${p.nome} como em falta` : `Marcar ${p.nome} como disponível`}
                        title={p.disponivel ? "Disponível: clique se acabou" : "Em falta: clique quando chegar"}
                      >
                        <span className={`inline-block size-5 rounded-full bg-white shadow transition ${p.disponivel ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {paginas > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-2 text-sm">
          {pagina > 1 && <Link href={link({ pagina: pagina - 1 })} className="botao-sec">← Anterior</Link>}
          <span className="text-gray-600">Página {pagina} de {paginas}</span>
          {pagina < paginas && <Link href={link({ pagina: pagina + 1 })} className="botao-sec">Próxima →</Link>}
        </nav>
      )}
    </div>
  );
}
