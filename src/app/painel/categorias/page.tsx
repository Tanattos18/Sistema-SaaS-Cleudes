import Link from "next/link";
import { asc, count, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo } from "@/components/ui";
import { excluirCategoria, salvarCategoria } from "./actions";

export const metadata = { title: "Categorias — Painel" };

export default async function CategoriasPage() {
  const usuario = await exigirUsuario();
  const db = await getDb();
  const C = schema.categorias;
  const categorias = await db
    .select({ id: C.id, nome: C.nome, icone: C.icone, ordem: C.ordem, ativo: C.ativo, produtos: count(schema.produtos.id) })
    .from(C)
    .leftJoin(schema.produtos, eq(schema.produtos.categoriaId, C.id))
    .where(eq(C.lojaId, usuario.lojaId))
    .groupBy(C.id)
    .orderBy(asc(C.ordem), asc(C.nome));

  return (
    <div className="max-w-4xl">
      <Cabecalho titulo="Categorias" descricao="A ordem define a sequência na loja. O ícone pode ser um emoji (🥩, 🍞, 🥤…)." />

      <ActionForm action={salvarCategoria} className="cartao mb-6" botao="Criar categoria">
        <div className="grid gap-3 sm:grid-cols-[1fr_100px_100px]">
          <Campo rotulo="Nova categoria"><input name="nome" className="campo" required maxLength={60} placeholder="ex.: Hortifrúti" /></Campo>
          <Campo rotulo="Ícone"><input name="icone" className="campo" maxLength={8} placeholder="🥬" /></Campo>
          <Campo rotulo="Ordem"><input name="ordem" type="number" min={0} max={999} className="campo" defaultValue={categorias.length} /></Campo>
        </div>
      </ActionForm>

      <ul className="space-y-2">
        {categorias.map((c) => (
          <li key={c.id} className="cartao p-3">
            <ActionForm action={salvarCategoria} botao="Salvar" botaoClasse="botao-sec">
              <input type="hidden" name="id" value={c.id} />
              <div className="grid items-end gap-3 sm:grid-cols-[1fr_80px_80px_auto_auto]">
                <Campo rotulo="Nome"><input name="nome" className="campo" defaultValue={c.nome} required maxLength={60} /></Campo>
                <Campo rotulo="Ícone"><input name="icone" className="campo" defaultValue={c.icone ?? ""} maxLength={8} /></Campo>
                <Campo rotulo="Ordem"><input name="ordem" type="number" min={0} max={999} className="campo" defaultValue={c.ordem} /></Campo>
                <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={c.ativo} /> Visível</label>
                <Link href={`/painel/produtos?categoria=${c.id}`} className="link pb-2 text-sm whitespace-nowrap">{c.produtos} produto(s)</Link>
              </div>
            </ActionForm>
            {c.produtos === 0 && (
              <form action={excluirCategoria} className="mt-2">
                <input type="hidden" name="id" value={c.id} />
                <button className="text-xs text-red-700 hover:underline">Excluir categoria vazia</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
