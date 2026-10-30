"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { pagarDeNovo } from "../../actions";

/** Gera um Pix novo ou abre de novo o pagamento do cartão (anterior expirado, recusado ou página fechada). */
export function BotaoPagar({ slug, codigo, rotulo }: { slug: string; codigo: string; rotulo: string }) {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [abrindo, iniciar] = useTransition();
  return (
    <div>
      <button
        type="button"
        disabled={abrindo}
        onClick={() =>
          iniciar(async () => {
            setErro("");
            const r = await pagarDeNovo(slug, codigo);
            if ("erro" in r) setErro(r.erro);
            else if (r.pagamento) window.location.href = r.pagamento;
            else router.refresh(); // Pix novo: aparece nesta mesma página
          })
        }
        className="w-full rounded-2xl bg-marca-azul py-4 text-lg font-bold text-white shadow-lg hover:bg-marca-azul-escuro disabled:opacity-50"
      >
        {abrindo ? "Gerando o pagamento…" : rotulo}
      </button>
      {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
