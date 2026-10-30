import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirAdmin } from "@/lib/auth";
import { DETALHE_PAGAMENTO, FORMAS_OFERECIDAS, ROTULO_PAGAMENTO, telefoneBR } from "@/lib/dominio";
import { impressoraConectada } from "@/lib/impressao";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo } from "@/components/ui";
import { conectarMercadoPago, desconectarMercadoPago, excluirBairro, gerarNovaChaveImpressao, salvarBairro, salvarHorarios, salvarLoja } from "./actions";

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

        <Secao titulo="Formas de pagamento" descricao="Só as marcadas aparecem para o cliente. Pix e cartão são pagos na hora, pelo Mercado Pago.">
          <div className="grid gap-2 sm:grid-cols-2">
            {FORMAS_OFERECIDAS.map((f) => {
              const online = f.startsWith("online_");
              return (
                <label key={f} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                  <input type="checkbox" name="formasPagamento" value={f} defaultChecked={loja.formasPagamento.includes(f)} className="mt-1" />
                  <span>
                    <span className="font-medium">{DETALHE_PAGAMENTO[f].icone} {ROTULO_PAGAMENTO[f]}</span>
                    <span className="block text-xs text-gray-500">{DETALHE_PAGAMENTO[f].texto}</span>
                    {online && !loja.mpAccessToken && <span className="block text-xs font-semibold text-amber-700">Só aparece depois de conectar o Mercado Pago (abaixo)</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </Secao>
      </ActionForm>

      <Secao titulo="Mercado Pago (Pix e cartão pelo site)" descricao="O dinheiro dos pedidos pagos no site cai direto na conta Mercado Pago da loja.">
        {loja.mpAccessToken ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1.5 text-sm font-semibold text-green-800">
              <span className="size-2 rounded-full bg-green-600" /> Conectado: {loja.mpConta ?? "conta Mercado Pago"}
            </p>
            <form action={desconectarMercadoPago}>
              <button className="botao-perigo">Desconectar</button>
            </form>
          </div>
        ) : (
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-800">
            <span className="size-2 rounded-full bg-amber-500" /> Não conectado: o cliente só vê dinheiro e maquininha
          </p>
        )}
        <details className="mt-4 text-sm" open={!loja.mpAccessToken}>
          <summary className="cursor-pointer font-medium text-marca-azul">{loja.mpAccessToken ? "Trocar a conta conectada" : "Como conectar"}</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-gray-700">
            <li>Entre em <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noopener noreferrer" className="link">mercadopago.com.br/developers</a> com a conta Mercado Pago da loja.</li>
            <li>Clique em <strong>Criar aplicação</strong> (nome: o da loja; solução: pagamentos online, Checkout Pro).</li>
            <li>Na aplicação, abra <strong>Credenciais de produção</strong> e copie o <strong>Access Token</strong> (começa com APP_USR-).</li>
            <li>Cole abaixo e salve. Para testar sem dinheiro de verdade, use as credenciais de teste.</li>
          </ol>
          <ActionForm action={conectarMercadoPago} botao="Conectar e testar" className="mt-3">
            <input name="token" type="password" className="campo" placeholder="APP_USR-..." autoComplete="off" required aria-label="Access Token do Mercado Pago" />
          </ActionForm>
        </details>
      </Secao>

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

      <Secao titulo="Impressora do balcão" descricao="Um programa no PC da loja busca os pedidos novos e imprime o comprovante sozinho na térmica.">
        <p className={`mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${impressoraConectada(loja.impressoraVistaEm) ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          <span className={`size-2 rounded-full ${impressoraConectada(loja.impressoraVistaEm) ? "bg-green-600" : "bg-red-600"}`} />
          {impressoraConectada(loja.impressoraVistaEm)
            ? "Conectada agora"
            : loja.impressoraVistaEm
              ? `Sem contato desde ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(loja.impressoraVistaEm)}`
              : "Programa ainda não instalado"}
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>No PC do balcão, instale o <a href="https://nodejs.org/pt" target="_blank" rel="noopener noreferrer" className="link">Node.js</a> (versão LTS) e a impressora Epson com o driver dela.</li>
          <li>
            Crie a pasta <code className="rounded bg-gray-100 px-1">C:\Impressora</code> e salve nela os arquivos:{" "}
            {["agente.js", "imprimir-windows.ps1", "iniciar.bat", "LEIA-ME.txt"].map((f) => (
              <a key={f} href={`/impressora/${f}`} download className="link mr-2 whitespace-nowrap">{f}</a>
            ))}
            e o <a href="/painel/impressora/config" download className="link font-bold">config.json desta loja</a> (já vem com a chave).
          </li>
          <li>Abra o <code className="rounded bg-gray-100 px-1">config.json</code> e confira o nome da impressora (como aparece em Impressoras do Windows) ou, se ela for de rede, troque o tipo para <code className="rounded bg-gray-100 px-1">rede</code> e coloque o IP.</li>
          <li>Dê dois cliques em <code className="rounded bg-gray-100 px-1">iniciar.bat</code>. Para testar: <code className="rounded bg-gray-100 px-1">iniciar.bat teste</code> imprime uma página de teste.</li>
        </ol>
        <form action={gerarNovaChaveImpressao} className="mt-4">
          <button className="botao-perigo">Gerar nova chave (o programa precisará do config.json novo)</button>
        </form>
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
