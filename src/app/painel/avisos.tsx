"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { chaveDosAvisos, removerAparelho, salvarAparelho, testarAvisos } from "./avisos-actions";

type Situacao = "carregando" | "sem-suporte" | "iphone-instalar" | "bloqueado" | "desligado" | "ligado";

const SW = "/avisos-sw.js";
const ESCOPO = "/painel/";

function nomeDoAparelho(): string {
  const ua = navigator.userAgent;
  const sistema = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : "Aparelho";
  const navegador = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return `${sistema}${navegador ? ` · ${navegador}` : ""}`;
}

function chaveEmBytes(b64: string): Uint8Array<ArrayBuffer> {
  const base = b64.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(base + "=".repeat((4 - (base.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Service worker dos avisos (escopo /painel/), já ativo: só então ele aceita a inscrição. */
async function registroAtivo(): Promise<ServiceWorkerRegistration> {
  const reg = (await navigator.serviceWorker.getRegistration(ESCOPO)) ?? (await navigator.serviceWorker.register(SW, { scope: ESCOPO, updateViaCache: "none" }));
  const w = reg.installing ?? reg.waiting;
  if (!reg.active && w) await new Promise<void>((ok) => w.addEventListener("statechange", () => w.state === "activated" && ok()));
  return reg;
}

/** Som curto quando chega pedido com o painel aberto. */
function tocarSom() {
  try {
    const ctx = new AudioContext();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {
    // navegador sem áudio liberado: fica só a notificação
  }
}

/** Liga as notificações de pedido neste aparelho (celular ou computador). */
export function AtivarAvisos({ compacto = false }: { compacto?: boolean }) {
  const router = useRouter();
  const [situacao, setSituacao] = useState<Situacao>("carregando");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    (async () => {
      const iphone = /iPhone|iPad/.test(navigator.userAgent);
      const instalado = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setSituacao(iphone && !instalado ? "iphone-instalar" : "sem-suporte");
      }
      if (Notification.permission === "denied") return setSituacao("bloqueado");
      const reg = await navigator.serviceWorker.getRegistration(ESCOPO);
      const inscricao = await reg?.pushManager.getSubscription();
      if (inscricao) {
        setSituacao("ligado");
        // Renova o cadastro deste aparelho no servidor.
        salvarAparelho(inscricao.toJSON(), nomeDoAparelho()).catch(() => {});
      } else setSituacao("desligado");
    })().catch(() => setSituacao("sem-suporte"));

    // Pedido novo com o painel aberto: toca o som e atualiza a lista.
    const aoReceber = (e: MessageEvent) => {
      if (e.data?.tipo !== "pedido-novo") return;
      tocarSom();
      router.refresh();
    };
    navigator.serviceWorker?.addEventListener("message", aoReceber);
    return () => navigator.serviceWorker?.removeEventListener("message", aoReceber);
  }, [router]);

  async function ativar() {
    setOcupado(true);
    setMensagem("Clique em PERMITIR na janela do navegador (ou no sininho 🔔 da barra de endereço).");
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setSituacao(permissao === "denied" ? "bloqueado" : "desligado");
        setMensagem(permissao === "denied" ? "" : "A permissão não foi dada.");
        return;
      }
      const [reg, chave] = await Promise.all([registroAtivo(), chaveDosAvisos()]);
      const opcoes = { userVisibleOnly: true, applicationServerKey: chaveEmBytes(chave) };
      const inscricao = await reg.pushManager.subscribe(opcoes).catch(async () => {
        // Inscrição antiga com outra chave: refaz.
        await (await reg.pushManager.getSubscription())?.unsubscribe();
        return reg.pushManager.subscribe(opcoes);
      });
      const r = await salvarAparelho(inscricao.toJSON(), nomeDoAparelho());
      if (!r.ok) throw new Error("o servidor não aceitou o cadastro.");
      setSituacao("ligado");
      setMensagem("Avisos ligados neste aparelho. Toque em “Enviar aviso de teste” para conferir.");
    } catch (e) {
      setMensagem(`Não foi possível ligar: ${(e as Error).message}`);
    } finally {
      setOcupado(false);
    }
  }

  async function desativar() {
    setOcupado(true);
    try {
      const inscricao = await (await navigator.serviceWorker.getRegistration(ESCOPO))?.pushManager.getSubscription();
      if (inscricao) {
        await removerAparelho(inscricao.endpoint);
        await inscricao.unsubscribe();
      }
      setSituacao("desligado");
      setMensagem("Avisos desligados neste aparelho.");
    } finally {
      setOcupado(false);
    }
  }

  async function testar() {
    setOcupado(true);
    try {
      const r = await testarAvisos();
      const zap = r.whatsapp === "enviado" ? " e no WhatsApp da loja" : r.whatsapp === "desligado" ? "" : ` (WhatsApp: ${r.whatsapp})`;
      setMensagem(r.aparelhos ? `Aviso enviado para ${r.aparelhos} aparelho(s)${zap}. Deve aparecer em instantes.` : `Nenhum aparelho recebeu${zap}. Desligue e ligue de novo neste aparelho.`);
    } finally {
      setOcupado(false);
    }
  }

  if (situacao === "carregando") return null;
  if (compacto && situacao === "ligado") return null;

  const caixa = compacto ? "rounded-2xl bg-marca-amarelo-claro p-4 text-sm ring-1 ring-marca-amarelo" : "text-sm";
  return (
    <div className={caixa}>
      {situacao === "ligado" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1.5 font-semibold text-green-800">
            <span className="size-2 rounded-full bg-green-600" /> Avisos ligados neste aparelho
          </span>
          <button type="button" className="botao-sec" disabled={ocupado} onClick={testar}>🔔 Enviar aviso de teste</button>
          <button type="button" className="botao-perigo" disabled={ocupado} onClick={desativar}>Desligar aqui</button>
        </div>
      ) : situacao === "desligado" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-semibold text-gray-900">🔔 Receba cada pedido novo como notificação neste aparelho, mesmo com o painel fechado.</p>
          <button type="button" className="botao" disabled={ocupado} onClick={ativar}>Ativar avisos neste aparelho</button>
        </div>
      ) : situacao === "iphone-instalar" ? (
        <p>🔔 No iPhone, os avisos funcionam com o painel instalado: toque em <strong>Compartilhar → Adicionar à Tela de Início</strong>, abra o painel pelo ícone e ative aqui.</p>
      ) : situacao === "bloqueado" ? (
        <p>🔕 As notificações estão bloqueadas neste navegador. Clique no cadeado ao lado do endereço → <strong>Notificações → Permitir</strong> e recarregue a página.</p>
      ) : (
        <p>Este navegador não recebe notificações. Use o Chrome, o Edge ou o Safari atualizado.</p>
      )}
      {mensagem && <p className="mt-2 text-gray-700">{mensagem}</p>}
    </div>
  );
}
