"use client";

import { useState } from "react";
import { Campo } from "@/components/ui";

type Tipo = "windows" | "comum" | "rede";

const TIPOS: { valor: Tipo; titulo: string; texto: string }[] = [
  { valor: "windows", titulo: "Térmica 80 mm (USB)", texto: "Epson TM-T88V ou outra térmica instalada no Windows" },
  { valor: "comum", titulo: "Impressora comum (A4)", texto: "Laser ou jato de tinta: o cupom sai no canto da folha" },
  { valor: "rede", titulo: "Térmica na rede (IP)", texto: "Térmica ligada no cabo de rede, porta 9100" },
];

/** Campos da escolha da impressora; mostra só o que vale para o tipo escolhido. */
export function CamposImpressora(props: {
  tipo: Tipo | null;
  nome: string | null;
  ip: string | null;
  porta: number | null;
  copias: number;
  disponiveis: string[];
}) {
  const [tipo, setTipo] = useState<Tipo>(props.tipo ?? "windows");
  const lista = props.disponiveis.includes(props.nome ?? "") || !props.nome ? props.disponiveis : [props.nome, ...props.disponiveis];

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {TIPOS.map((t) => (
          <label key={t.valor} className={`flex cursor-pointer gap-2 rounded-xl border-2 p-3 text-sm ${tipo === t.valor ? "border-marca-azul bg-marca-azul-claro" : "border-gray-200"}`}>
            <input type="radio" name="tipo" value={t.valor} checked={tipo === t.valor} onChange={() => setTipo(t.valor)} className="mt-0.5 accent-marca-azul" />
            <span>
              <span className="block font-semibold">{t.titulo}</span>
              <span className="block text-xs text-gray-500">{t.texto}</span>
            </span>
          </label>
        ))}
      </div>

      {tipo === "rede" ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <Campo rotulo="IP da impressora">
            <input name="ip" className="campo" defaultValue={props.ip ?? ""} placeholder="192.168.0.100" required />
          </Campo>
          <Campo rotulo="Porta">
            <input name="porta" type="number" className="campo" defaultValue={props.porta ?? 9100} min={1} max={65535} />
          </Campo>
        </div>
      ) : lista.length ? (
        <Campo rotulo="Impressora (instaladas no computador do balcão)">
          <select name="nome" className="campo" defaultValue={props.nome ?? ""} required>
            <option value="" disabled>Escolha a impressora…</option>
            {lista.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </Campo>
      ) : (
        <Campo rotulo="Nome da impressora no Windows">
          <input name="nome" className="campo" defaultValue={props.nome ?? ""} placeholder="ex.: EPSON TM-T88V Receipt" required />
          <span className="mt-1 block text-xs text-gray-500">A lista aparece aqui sozinha quando o programa do balcão estiver rodando.</span>
        </Campo>
      )}

      <Campo rotulo="Vias por pedido">
        <select name="copias" className="campo sm:w-48" defaultValue={String(props.copias)}>
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>{n === 1 ? "1 via" : `${n} vias${n === 2 ? " (separar + entregador)" : ""}`}</option>
          ))}
        </select>
      </Campo>
    </div>
  );
}
