import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirAdmin } from "@/lib/auth";
import { DETALHE_PAGAMENTO, FORMAS_OFERECIDAS, ROTULO_PAGAMENTO, telefoneBR } from "@/lib/dominio";
import { impressoraConectada, impressoraDoPainel } from "@/lib/impressao";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo } from "@/components/ui";
import { urlDoSite } from "@/lib/loja";
import {
  conectarMercadoPago,
  desconectarMercadoPago,
  excluirBairro,
  gerarNovaChaveImpressao,
  ligarAvisoWhatsapp,
  pedirTesteImpressao,
  salvarAssinaturaWebhook,
  salvarBairro,
  salvarHorarios,
  salvarImpressora,
  salvarLoja,
} from "./actions";
import { CamposImpressora } from "./impressora";
import { AtivarAvisos } from "../avisos";
import { whatsappConfigurado } from "@/lib/whatsapp-meta";

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
  const [[loja], horarios, bairros, aparelhos] = await Promise.all([
    db.select().from(schema.lojas).where(eq(schema.lojas.id, admin.lojaId)),
    db.select().from(schema.horarios).where(eq(schema.horarios.lojaId, admin.lojaId)),
    db.select().from(schema.bairros).where(eq(schema.bairros.lojaId, admin.lojaId)).orderBy(asc(schema.bairros.nome)),
    db.select({ aparelho: schema.inscricoesPush.aparelho }).from(schema.inscricoesPush).where(eq(schema.inscricoesPush.lojaId, admin.lojaId)),
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
            <li>Clique em <strong>Criar aplicação</strong> (nome: o da loja; solução: pagamentos online).</li>
            <li>Na aplicação, abra <strong>Credenciais de produção</strong> e copie o <strong>Access Token</strong> (começa com APP_USR-).</li>
            <li>Cole abaixo e salve. Para testar sem dinheiro de verdade, use as credenciais de teste.</li>
          </ol>
          <ActionForm action={conectarMercadoPago} botao="Conectar e testar" className="mt-3">
            <input name="token" type="password" className="campo" placeholder="APP_USR-..." autoComplete="off" required aria-label="Access Token do Mercado Pago" />
          </ActionForm>
        </details>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium text-marca-azul">
            Aviso automático de pagamento (webhook) {loja.mpWebhookSecret ? "· assinatura cadastrada ✓" : ""}
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-gray-700">
            <li>Na aplicação do Mercado Pago, abra <strong>Webhooks → Configurar notificações</strong> (modo produção).</li>
            <li>
              URL: <code className="rounded bg-gray-100 px-1 break-all">{`${urlDoSite()}/api/pagamentos/mercadopago/${loja.slug}`}</code>
            </li>
            <li>Eventos: marque <strong>Order (Mercado Pago)</strong>, para o Pix, e <strong>Pagamentos</strong>, para o cartão. Salve.</li>
            <li>Copie a <strong>assinatura secreta</strong> que aparece e cole abaixo.</li>
          </ol>
          <p className="mt-2 text-xs text-gray-500">Mesmo sem isso o pedido é liberado (a página do pedido e o programa da impressora conferem o pagamento), mas o aviso deixa tudo instantâneo.</p>
          <ActionForm action={salvarAssinaturaWebhook} botao="Salvar assinatura" className="mt-3">
            <input name="segredo" type="password" className="campo" placeholder={loja.mpWebhookSecret ? "•••••••• (deixe vazio e salve para remover)" : "assinatura secreta"} autoComplete="off" aria-label="Assinatura secreta do webhook" />
          </ActionForm>
        </details>
      </Secao>

      <Secao titulo="Avisos de pedido" descricao="Cada pedido novo avisa o dono sozinho, sem ninguém apertar nada. Pedido pago no site só avisa depois de aprovado.">
        <h3 className="mb-2 font-semibold text-gray-900">Notificação no painel</h3>
        <p className="mb-3 text-sm text-gray-600">
          Ative em cada celular ou computador que deve receber. Grátis. {aparelhos.length ? `Recebendo hoje: ${aparelhos.map((a) => a.aparelho ?? "aparelho").join(", ")}.` : "Nenhum aparelho ativado ainda."}
        </p>
        <AtivarAvisos />

        <h3 className="mt-6 mb-2 font-semibold text-gray-900">WhatsApp da loja ({telefoneBR(loja.whatsapp)})</h3>
        {!whatsappConfigurado() ? (
          <p className="rounded-xl bg-gray-100 p-3 text-sm text-gray-700">
            O WhatsApp oficial ainda não está configurado no sistema. Quando estiver, cada pedido também chega como mensagem no WhatsApp da loja, enviada pelo número oficial da Akylla.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${loja.avisoWhatsappAtivo ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
              <span className={`size-2 rounded-full ${loja.avisoWhatsappAtivo ? "bg-green-600" : "bg-amber-500"}`} />
              {loja.avisoWhatsappAtivo ? "Ligado: cada pedido chega no WhatsApp da loja" : "Desligado"}
            </p>
            <form action={ligarAvisoWhatsapp}>
              <input type="hidden" name="ligar" value={loja.avisoWhatsappAtivo ? "0" : "1"} />
              <button className={loja.avisoWhatsappAtivo ? "botao-perigo" : "botao"}>{loja.avisoWhatsappAtivo ? "Desligar" : "Ligar aviso no WhatsApp"}</button>
            </form>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-500">O número que recebe é o de Dados da loja. O teste do botão “Enviar aviso de teste” também vai para o WhatsApp quando ele estiver ligado.</p>
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

      <Secao titulo="Impressora do balcão" descricao="Um programa no computador da loja busca os pedidos novos e imprime o comprovante sozinho.">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${impressoraConectada(loja.impressoraVistaEm) ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            <span className={`size-2 rounded-full ${impressoraConectada(loja.impressoraVistaEm) ? "bg-green-600" : "bg-red-600"}`} />
            {impressoraConectada(loja.impressoraVistaEm)
              ? `Programa conectado${loja.impressoraComputador ? ` no computador ${loja.impressoraComputador}` : ""}`
              : loja.impressoraVistaEm
                ? `Sem contato desde ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(loja.impressoraVistaEm)}`
                : "Programa ainda não instalado"}
          </p>
          {loja.impressaoTestePedidaEm ? (
            <p className="text-sm font-semibold text-amber-700">Página de teste na fila: sai assim que o programa consultar (alguns segundos).</p>
          ) : (
            <form action={pedirTesteImpressao}>
              <button className="botao-sec">🖨️ Imprimir página de teste</button>
            </form>
          )}
        </div>

        <h3 className="mb-2 font-semibold text-gray-900">Qual impressora imprime os pedidos</h3>
        <ActionForm action={salvarImpressora} botao="Salvar impressora">
          <CamposImpressora
            tipo={loja.impressoraTipo}
            nome={loja.impressoraNome}
            ip={loja.impressoraIp}
            porta={loja.impressoraPorta}
            copias={loja.impressoraCopias}
            disponiveis={loja.impressorasDisponiveis ?? []}
          />
        </ActionForm>
        <p className="mt-2 text-xs text-gray-500">
          {impressoraDoPainel(loja)
            ? "O programa usa esta escolha e troca sozinho, sem mexer no computador do balcão."
            : "Enquanto nada for salvo aqui, o programa usa a impressora do config.json."}
        </p>

        <details className="mt-5 text-sm">
          <summary className="cursor-pointer font-medium text-marca-azul">Como instalar o programa no computador do balcão</summary>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-gray-700">
            <li>Instale o <a href="https://nodejs.org/pt" target="_blank" rel="noopener noreferrer" className="link">Node.js</a> (versão LTS) e a impressora com o driver dela.</li>
            <li>
              Crie a pasta <code className="rounded bg-gray-100 px-1">C:\Impressora</code> e salve nela os arquivos:{" "}
              {["agente.js", "imprimir-windows.ps1", "imprimir-comum.ps1", "iniciar.bat", "LEIA-ME.txt"].map((f) => (
                <a key={f} href={`/impressora/${f}`} download className="link mr-2 whitespace-nowrap">{f}</a>
              ))}
              e o <a href="/painel/impressora/config" download className="link font-bold">config.json desta loja</a> (já vem com a chave).
            </li>
            <li>Dê dois cliques em <code className="rounded bg-gray-100 px-1">iniciar.bat</code> e deixe a janela aberta (pode minimizar).</li>
            <li>Volte aqui: a lista de impressoras do computador aparece acima. Escolha, salve e clique em <strong>Imprimir página de teste</strong>.</li>
          </ol>
          <form action={gerarNovaChaveImpressao} className="mt-4">
            <button className="botao-perigo">Gerar nova chave (o programa precisará do config.json novo)</button>
          </form>
        </details>
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
