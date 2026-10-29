import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirAdmin } from "@/lib/auth";
import { FORMAS_DISPONIVEIS, ROTULO_PAGAMENTO, telefoneBR } from "@/lib/dominio";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo } from "@/components/ui";
import { excluirBairro, salvarBairro, salvarHorarios, salvarLoja } from "./actions";

export const metadata = { title: "Configurações — Painel" };

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const valorBR = (v: number | null | undefined) => (v == null ? "" : v.toFixed(2).replace(".", ","));

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="cartao">
      <h2 className="font-semibold text-gray-900">{titulo}</h2>
      {descricao && <p className="mb-4 text-sm text-gray-500">{descricao}</p>}
      {children}
    </section>
  );
}

export default async function ConfiguracoesPage() {
  const admin = await exigirAdmin();
  const db = await getDb();
  const [[loja], horarios, bairros] = await Promise.all([
    db.select().from(schema.lojas).where(eq(schema.lojas.id, admin.lojaId)),
    db.select().from(schema.horarios).where(eq(schema.horarios.lojaId, admin.lojaId)),
    db.select().from(schema.bairros).where(eq(schema.bairros.lojaId, admin.lojaId)).orderBy(asc(schema.bairros.nome)),
  ]);
  const doDia = (d: number) => horarios.find((h) => h.diaSemana === d);

  return (
    <div className="max-w-4xl space-y-6">
      <Cabecalho titulo="Configurações da loja" descricao={`Endereço da loja: /${loja.slug}. As mudanças aparecem na hora para os clientes.`} />

      <ActionForm action={salvarLoja} className="space-y-6" botao="Salvar configurações">
        <Secao titulo="Dados da loja">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome da loja"><input name="nome" className="campo" defaultValue={loja.nome} required maxLength={80} /></Campo>
            <Campo rotulo="WhatsApp que recebe os pedidos"><input name="whatsapp" className="campo" defaultValue={telefoneBR(loja.whatsapp)} required /></Campo>
            <Campo rotulo="Endereço da loja" className="sm:col-span-2"><input name="endereco" className="campo" defaultValue={loja.endereco ?? ""} maxLength={500} /></Campo>
            <Campo rotulo="Frase de boas-vindas na loja" className="sm:col-span-2"><input name="mensagemBoasVindas" className="campo" defaultValue={loja.mensagemBoasVindas ?? ""} maxLength={200} /></Campo>
          </div>
        </Secao>

        <Secao titulo="Entrega" descricao="Taxa fixa vale para qualquer endereço. Por bairro, só os bairros cadastrados abaixo são atendidos.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Pedido mínimo (R$)"><input name="pedidoMinimo" className="campo" inputMode="decimal" defaultValue={valorBR(loja.pedidoMinimo)} /></Campo>
            <Campo rotulo="Como cobrar a entrega">
              <select name="modoTaxa" className="campo" defaultValue={loja.modoTaxa}>
                <option value="fixa">Taxa fixa</option>
                <option value="bairro">Taxa por bairro</option>
              </select>
            </Campo>
            <Campo rotulo="Taxa fixa (R$)"><input name="taxaFixa" className="campo" inputMode="decimal" defaultValue={valorBR(loja.taxaFixa)} /></Campo>
            <Campo rotulo="Frete grátis a partir de (R$, vazio = nunca)"><input name="freteGratisAcima" className="campo" inputMode="decimal" defaultValue={valorBR(loja.freteGratisAcima)} /></Campo>
          </div>
        </Secao>

        <Secao titulo="Formas de pagamento" descricao="Só as marcadas aparecem para o cliente.">
          <div className="grid gap-2 sm:grid-cols-2">
            {FORMAS_DISPONIVEIS.map((f) => (
              <label key={f} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                <input type="checkbox" name="formasPagamento" value={f} defaultChecked={loja.formasPagamento.includes(f)} /> {ROTULO_PAGAMENTO[f]}
              </label>
            ))}
            {(["online_pix", "online_cartao"] as const).map((f) => (
              <label key={f} className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-gray-400" title="Disponível após a integração com o Mercado Pago">
                <input type="checkbox" disabled /> {ROTULO_PAGAMENTO[f]} <span className="text-xs">(em breve, Mercado Pago)</span>
              </label>
            ))}
          </div>
        </Secao>
      </ActionForm>

      <Secao titulo="Horário de funcionamento" descricao="Fora do horário a loja mostra “fechado” e não aceita pedidos.">
        <ActionForm action={salvarHorarios} botao="Salvar horários">
          <div className="space-y-2">
            {DIAS.map((d, i) => {
              const h = doDia(i);
              return (
                <div key={d} className="grid grid-cols-[110px_1fr_1fr] items-center gap-3 text-sm sm:grid-cols-[140px_140px_140px]">
                  <label className="flex items-center gap-2 font-medium"><input type="checkbox" name={`aberto-${i}`} defaultChecked={!!h} /> {d}</label>
                  <input type="time" name={`abre-${i}`} className="campo" defaultValue={h?.abre ?? "06:00"} aria-label={`${d}: abre`} />
                  <input type="time" name={`fecha-${i}`} className="campo" defaultValue={h?.fecha ?? "20:00"} aria-label={`${d}: fecha`} />
                </div>
              );
            })}
          </div>
        </ActionForm>
      </Secao>

      <Secao titulo="Bairros atendidos" descricao={loja.modoTaxa === "bairro" ? "Em uso: cada bairro tem sua taxa." : "Usados só quando a entrega é cobrada por bairro."}>
        <ActionForm action={salvarBairro} botao="Adicionar bairro" className="mb-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <Campo rotulo="Bairro"><input name="nome" className="campo" required maxLength={80} /></Campo>
            <Campo rotulo="Taxa (R$)"><input name="taxa" className="campo" inputMode="decimal" required placeholder="0,00" /></Campo>
          </div>
        </ActionForm>
        <ul className="divide-y">
          {bairros.map((b) => (
            <li key={b.id} className="py-2">
              <ActionForm action={salvarBairro} botao="Salvar" botaoClasse="botao-sec">
                <input type="hidden" name="id" value={b.id} />
                <div className="grid items-end gap-3 sm:grid-cols-[1fr_120px_auto]">
                  <input name="nome" className="campo" defaultValue={b.nome} required maxLength={80} aria-label="Bairro" />
                  <input name="taxa" className="campo" inputMode="decimal" defaultValue={valorBR(b.taxa)} required aria-label="Taxa" />
                  <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={b.ativo} /> Atende</label>
                </div>
              </ActionForm>
              <form action={excluirBairro} className="mt-1">
                <input type="hidden" name="id" value={b.id} />
                <button className="text-xs text-red-700 hover:underline">Remover bairro</button>
              </form>
            </li>
          ))}
        </ul>
      </Secao>
    </div>
  );
}
