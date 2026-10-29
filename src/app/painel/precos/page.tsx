import Link from "next/link";
import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { dataBR, moeda } from "@/lib/formato";
import { Cabecalho, Vazio } from "@/components/ui";
import { aplicarPrecosAgendados } from "@/lib/precos";
import { cancelarAgendamento } from "../produtos/actions";

export const metadata = { title: "Preços agendados — Painel" };

export default async function PrecosPage() {
  const usuario = await exigirUsuario();
  const db = await getDb();
  // Os que venceram desde o último acesso à vitrine entram agora, para a lista não mostrar atrasados.
  await aplicarPrecosAgendados(db, usuario.lojaId);
  const A = schema.precosAgendados;
  const P = schema.produtos;
  const colunas = { id: A.id, preco: A.preco, vigenteEm: A.vigenteEm, promocao: A.promocao, aplicadoEm: A.aplicadoEm, produtoId: P.id, nome: P.nome, precoAtual: P.preco, unidade: P.unidade, usuario: schema.usuarios.nome };
  const base = () =>
    db.select(colunas).from(A).innerJoin(P, eq(P.id, A.produtoId)).leftJoin(schema.usuarios, eq(schema.usuarios.id, A.usuarioId));
  const [pendentes, aplicados] = await Promise.all([
    base().where(and(eq(P.lojaId, usuario.lojaId), isNull(A.aplicadoEm))).orderBy(asc(A.vigenteEm), asc(P.nome)),
    base().where(and(eq(P.lojaId, usuario.lojaId), isNotNull(A.aplicadoEm))).orderBy(desc(A.aplicadoEm)).limit(30),
  ]);

  return (
    <div>
      <Cabecalho
        titulo="Preços agendados"
        descricao="Mudanças de preço que entram sozinhas na data marcada. Para agendar, abra o produto ou importe a planilha com uma data."
        acoes={<Link href="/painel/produtos/importar" className="botao-sec">Importar planilha</Link>}
      />
      <div className="cartao mb-6 overflow-x-auto p-0">
        <h2 className="border-b px-4 py-3 font-semibold">A aplicar ({pendentes.length})</h2>
        {pendentes.length === 0 ? (
          <Vazio>Nenhuma mudança de preço agendada.</Vazio>
        ) : (
          <table className="tabela">
            <thead><tr><th>A partir de</th><th>Produto</th><th className="text-right">Hoje</th><th className="text-right">Novo</th><th>Quem agendou</th><th /></tr></thead>
            <tbody>
              {pendentes.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium whitespace-nowrap">{dataBR(a.vigenteEm)}</td>
                  <td><Link href={`/painel/produtos/${a.produtoId}`} className="link">{a.nome}</Link>{a.promocao && <span className="ml-2 text-xs text-marca-vermelho">promoção</span>}</td>
                  <td className="text-right text-gray-500">{moeda(a.precoAtual)}</td>
                  <td className={`text-right font-semibold ${a.preco < a.precoAtual ? "text-green-700" : "text-marca-vermelho"}`}>{moeda(a.preco)}{a.unidade === "kg" && "/kg"}</td>
                  <td className="text-xs text-gray-500">{a.usuario ?? "—"}</td>
                  <td className="text-right">
                    <form action={cancelarAgendamento}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="text-xs text-red-700 hover:underline">Cancelar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {aplicados.length > 0 && (
        <div className="cartao overflow-x-auto p-0">
          <h2 className="border-b px-4 py-3 font-semibold">Aplicados recentemente</h2>
          <table className="tabela">
            <thead><tr><th>Data</th><th>Produto</th><th className="text-right">Preço</th></tr></thead>
            <tbody>
              {aplicados.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap">{dataBR(a.vigenteEm)}</td>
                  <td><Link href={`/painel/produtos/${a.produtoId}`} className="link">{a.nome}</Link></td>
                  <td className="text-right">{moeda(a.preco)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
