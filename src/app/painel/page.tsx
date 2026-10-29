import Link from "next/link";
import { getDb } from "@/db";
import { STATUS_PEDIDO, type StatusPedido } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth";
import { pedidosDoPainel, resumoDoDia } from "@/lib/consultas";
import { ROTULO_PAGAMENTO, ROTULO_STATUS, telefoneBR } from "@/lib/dominio";
import { moeda } from "@/lib/formato";
import { Cabecalho, Indicador, Selo, Vazio } from "@/components/ui";
import { AutoAtualizar } from "./auto-atualizar";

export const metadata = { title: "Pedidos — Painel" };

export default async function PainelPage({ searchParams }: PageProps<"/painel">) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  const filtro = typeof sp.status === "string" && (STATUS_PEDIDO as readonly string[]).includes(sp.status) ? (sp.status as StatusPedido) : null;
  const db = await getDb();
  const [pedidos, resumo] = await Promise.all([pedidosDoPainel(db, usuario.lojaId, filtro), resumoDoDia(db, usuario.lojaId)]);

  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <AutoAtualizar segundos={20} />
      <Cabecalho titulo="Pedidos" descricao={filtro ? `${ROTULO_STATUS[filtro]} (últimos 7 dias)` : "Em andamento. A lista atualiza sozinha."} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Pedidos hoje" valor={String(resumo.pedidosHoje)} />
        <Indicador rotulo="Vendido hoje" valor={moeda(resumo.faturamentoHoje)} detalhe={resumo.pedidosHoje ? `Ticket médio ${moeda(resumo.faturamentoHoje / resumo.pedidosHoje)}` : undefined} />
        <Indicador rotulo="Em andamento" valor={String(resumo.emAndamento)} detalhe="novos, separando ou a caminho" />
        <Link href="/painel/produtos?situacao=indisponivel" className="block"><Indicador rotulo="Produtos em falta" valor={String(resumo.emFalta)} detalhe="toque para ver" /></Link>
      </div>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/painel" className={!filtro ? "botao" : "botao-sec"}>Em andamento</Link>
        {(["entregue", "cancelado"] as const).map((s) => (
          <Link key={s} href={`/painel?status=${s}`} className={filtro === s ? "botao" : "botao-sec"}>{ROTULO_STATUS[s]}</Link>
        ))}
      </div>
      <div className="cartao overflow-x-auto p-0">
        {pedidos.length === 0 ? (
          <Vazio>Nenhum pedido aqui.</Vazio>
        ) : (
          <table className="tabela">
            <thead>
              <tr><th>Nº</th><th>Hora</th><th>Cliente</th><th>Bairro</th><th>Pagamento</th><th className="text-right">Total</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td><Link href={`/painel/pedidos/${p.id}`} className="link">#{p.numero}</Link></td>
                  <td className="whitespace-nowrap">{hora.format(p.criadoEm)}</td>
                  <td>{p.clienteNome}<span className="block text-xs text-gray-500">{telefoneBR(p.clienteTelefone)}</span></td>
                  <td>{p.bairro}</td>
                  <td className="text-xs">{ROTULO_PAGAMENTO[p.formaPagamento]}{p.pagoEm ? " ✓" : ""}</td>
                  <td className="text-right font-medium">{moeda(p.total)}</td>
                  <td><Selo tipo={p.status}>{ROTULO_STATUS[p.status]}</Selo></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
