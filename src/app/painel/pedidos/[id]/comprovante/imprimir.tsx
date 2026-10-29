"use client";

import { useEffect } from "react";

/** Abre a janela de impressão assim que o comprovante carrega; o botão serve para imprimir de novo. */
export function ImprimirAoAbrir() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="mb-4 flex justify-center gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className="botao">Imprimir</button>
      <button type="button" onClick={() => window.close()} className="botao-sec">Fechar</button>
    </div>
  );
}
