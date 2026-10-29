import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { dataBR, hojeISO, moeda, somarDias } from "@/lib/formato";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo, Selo } from "@/components/ui";
import { agendarPreco, cancelarAgendamento, salvarProduto } from "../actions";

export const metadata = { title: "Produto — Painel" };

const valorBR = (v: number | null | undefined) => (v == null ? "" : v.toFixed(2).replace(".", ","));

export default async function ProdutoPage({ params }: PageProps<"/painel/produtos/[id]">) {
  const usuario = await exigirUsuario();
  const { id } = await params;
  const novo = id === "novo";
  const db = await getDb();

  const categorias = await db
    .select({ id: schema.categorias.id, nome: schema.categorias.nome })
    .from(schema.categorias)
    .where(eq(schema.categorias.lojaId, usuario.lojaId))
    .orderBy(asc(schema.categorias.ordem), asc(schema.categorias.nome));

  let produto: typeof schema.produtos.$inferSelect | undefined;
  let agendamentos: (typeof schema.precosAgendados.$inferSelect)[] = [];
  if (!novo) {
    [produto] = await db
      .select()
      .from(schema.produtos)
      .where(and(eq(schema.produtos.id, Number(id) || 0), eq(schema.produtos.lojaId, usuario.lojaId)));
    if (!produto) notFound();
    agendamentos = await db
      .select()
      .from(schema.precosAgendados)
      .where(eq(schema.precosAgendados.produtoId, produto.id))
      .orderBy(desc(schema.precosAgendados.vigenteEm), desc(schema.precosAgendados.id))
      .limit(15);
  }
  if (categorias.length === 0) {
    return (
      <div className="max-w-xl">
        <Cabecalho titulo="Novo produto" />
        <p className="cartao">Cadastre antes uma categoria em <Link href="/painel/categorias" className="link">Categorias</Link>.</p>
      </div>
    );
  }
  const amanha = somarDias(hojeISO(), 1);

  return (
    <div className="max-w-4xl">
      <Link href="/painel/produtos" className="link text-sm">← Produtos</Link>
      <Cabecalho titulo={novo ? "Novo produto" : produto!.nome} descricao={produto ? `Preço atual ${moeda(produto.preco)}${produto.unidade === "kg" ? " o quilo" : ""}` : undefined} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <ActionForm action={salvarProduto} className="cartao">
          {produto && <input type="hidden" name="id" value={produto.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome do produto" className="sm:col-span-2">
              <input name="nome" className="campo" defaultValue={produto?.nome} required maxLength={120} />
            </Campo>
            <Campo rotulo="Categoria">
              <select name="categoriaId" className="campo" defaultValue={produto?.categoriaId ?? categorias[0].id}>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Código (do caixa ou de barras)">
              <input name="codigo" className="campo" defaultValue={produto?.codigo ?? ""} maxLength={40} />
            </Campo>
            <Campo rotulo="Como é vendido">
              <select name="unidade" className="campo" defaultValue={produto?.unidade ?? "un"}>
                <option value="un">Por unidade</option>
                <option value="kg">Por quilo (cliente pede pelo valor)</option>
              </select>
            </Campo>
            <Campo rotulo="Preço (R$, por unidade ou por quilo)">
              <input name="preco" className="campo" inputMode="decimal" defaultValue={valorBR(produto?.preco)} required placeholder="0,00" />
            </Campo>
            <Campo rotulo="Preço “de” riscado (opcional, em promoção)">
              <input name="precoDe" className="campo" inputMode="decimal" defaultValue={valorBR(produto?.precoDe)} placeholder="ex.: 44,90" />
            </Campo>
            <Campo rotulo="Preço do vasilhame (só gás e galão de água)">
              <input name="precoVasilhame" className="campo" inputMode="decimal" defaultValue={valorBR(produto?.precoVasilhame)} placeholder="ex.: 180,00" />
            </Campo>
            <Campo rotulo="Foto (endereço https:// da imagem)" className="sm:col-span-2">
              <input name="imagemUrl" className="campo" defaultValue={produto?.imagemUrl ?? ""} placeholder="https://…" maxLength={500} />
            </Campo>
            <Campo rotulo="Descrição (opcional)" className="sm:col-span-2">
              <textarea name="descricao" className="campo" rows={2} defaultValue={produto?.descricao ?? ""} maxLength={500} />
            </Campo>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="disponivel" defaultChecked={produto?.disponivel ?? true} /> Disponível (tem no estoque)
            </label>
            {produto && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="ativo" defaultChecked={produto.ativo} /> No catálogo (desmarque para tirar da loja)
              </label>
            )}
          </div>
        </ActionForm>

        <aside className="space-y-4">
          {produto?.imagemUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={produto.imagemUrl} alt="" className="aspect-[4/3] w-full rounded-lg object-cover shadow-sm" />
          )}
          {produto && (
            <div className="cartao">
              <h2 className="mb-1 font-semibold">Mudar o preço numa data</h2>
              <p className="mb-3 text-xs text-gray-500">Ex.: hoje cadastra a promoção, amanhã o preço novo entra sozinho na loja.</p>
              <ActionForm action={agendarPreco} botao="Agendar preço">
                <input type="hidden" name="produtoId" value={produto.id} />
                <div className="space-y-3">
                  <Campo rotulo="Novo preço (R$)">
                    <input name="preco" className="campo" inputMode="decimal" required placeholder="0,00" />
                  </Campo>
                  <Campo rotulo="A partir de">
                    <input name="vigenteEm" type="date" className="campo" defaultValue={amanha} min={hojeISO()} required />
                  </Campo>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="promocao" defaultChecked /> É promoção (mostra o preço antigo riscado)
                  </label>
                </div>
              </ActionForm>
            </div>
          )}
          {agendamentos.length > 0 && (
            <div className="cartao p-0">
              <h2 className="border-b px-4 py-3 text-sm font-semibold">Histórico de preços</h2>
              <ul className="divide-y text-sm">
                {agendamentos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 px-4 py-2">
                    <span>
                      <strong>{moeda(a.preco)}</strong> a partir de {dataBR(a.vigenteEm)}
                      {a.promocao && <span className="ml-1 text-xs text-marca-vermelho">promoção</span>}
                    </span>
                    {a.aplicadoEm ? (
                      <Selo tipo="entregue">aplicado</Selo>
                    ) : (
                      <form action={cancelarAgendamento}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="text-xs text-red-700 hover:underline">Cancelar</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
