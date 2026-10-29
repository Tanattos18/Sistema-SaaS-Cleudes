import Link from "next/link";
import type { Horario } from "@/lib/horario";
import { telefoneBR } from "@/lib/dominio";
import { IconeLocal, IconeRelogio, IconeWhatsApp } from "@/components/icones";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Marca da loja no estilo do letreiro: inicial num selo azul e o nome em letras fortes. */
export function Logo({ nome, slug, compacto = false }: { nome: string; slug: string; compacto?: boolean }) {
  // "Supermercado Caixeta" → destaque "Caixeta"; nomes de uma palavra ficam inteiros.
  const palavras = nome.split(" ");
  const destaque = palavras.length > 1 ? palavras[palavras.length - 1] : nome;
  const resto = palavras.length > 1 ? palavras.slice(0, -1).join(" ") : "";
  return (
    <Link href={`/${slug}`} className="flex min-w-0 items-center gap-2.5" aria-label={`${nome}, início`}>
      <span className={`grid shrink-0 place-items-center rounded-2xl bg-marca-azul font-titulos font-extrabold text-marca-amarelo shadow-md ring-2 ring-white/70 ${compacto ? "size-10 text-2xl" : "size-12 text-3xl"}`}>
        {destaque[0]}
      </span>
      <span className="min-w-0 leading-none">
        {resto && <span className="block truncate text-[11px] font-bold tracking-wide text-marca-azul uppercase">{resto}</span>}
        <span className={`block truncate font-titulos font-extrabold text-marca-azul-escuro ${compacto ? "text-2xl" : "text-[28px]"}`}>{destaque}</span>
      </span>
    </Link>
  );
}

export type DadosRodape = { nome: string; slug: string; endereco: string | null; whatsapp: string; horarios: Horario[] };

export function RodapeLoja({ loja }: { loja: DadosRodape }) {
  return (
    <footer className="mt-10 bg-marca-azul-escuro text-blue-100">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <p className="font-titulos text-2xl font-extrabold text-marca-amarelo">{loja.nome}</p>
          <p className="text-sm">Açougue, padaria, supermercado, gás e bebidas, com entrega na sua casa.</p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2 font-bold text-white"><IconeRelogio /> Horário</p>
          <ul className="space-y-0.5">
            {DIAS.map((d, i) => {
              const h = loja.horarios.filter((x) => x.diaSemana === i);
              return (
                <li key={d} className="flex justify-between gap-4">
                  <span>{d}</span>
                  <span className="text-white">{h.length ? h.map((x) => `${x.abre}–${x.fecha}`).join(", ") : "fechado"}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2 font-bold text-white"><IconeWhatsApp /> Atendimento</p>
          <a href={`https://wa.me/${loja.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-700">
            <IconeWhatsApp /> {telefoneBR(loja.whatsapp)}
          </a>
          {loja.endereco && <p className="flex gap-2"><IconeLocal className="shrink-0" /> {loja.endereco}</p>}
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-bold text-white">Formas de pagamento</p>
          <p>Pix, cartões de crédito e débito, vale-refeição e dinheiro na entrega.</p>
          <p className="flex flex-wrap gap-x-4 pt-2 text-xs">
            <Link href="/login" className="font-bold text-marca-amarelo underline">Área do lojista</Link>
            <Link href="/creditos-imagens" className="text-blue-200 underline">Créditos das imagens</Link>
          </p>
        </div>
      </div>
      <p className="border-t border-white/10 py-4 text-center text-xs text-blue-200">Pedidos online · {loja.nome}</p>
    </footer>
  );
}
