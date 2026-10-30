"use client";

import { useEffect, useState } from "react";

/** QR code e "Pix copia e cola" do pedido, com contagem regressiva até o Pix expirar. */
export function PagarComPix({ copiaECola, qrCode, expiraEm }: { copiaECola: string; qrCode: string | null; expiraEm: string }) {
  const [copiado, setCopiado] = useState(false);
  const [restante, setRestante] = useState(() => new Date(expiraEm).getTime() - Date.now());

  useEffect(() => {
    const t = setInterval(() => setRestante(new Date(expiraEm).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiraEm]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(copiaECola);
    } catch {
      // Navegador sem permissão de copiar: seleciona o texto para o cliente copiar à mão.
      (document.getElementById("pix-codigo") as HTMLTextAreaElement | null)?.select();
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  }

  const min = Math.max(0, Math.floor(restante / 60000));
  const seg = Math.max(0, Math.floor((restante % 60000) / 1000));

  return (
    <div className="rounded-2xl bg-white p-4 text-gray-900 shadow-sm">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {qrCode && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:image/png;base64,${qrCode}`} alt="QR code do Pix" width={200} height={200} className="size-48 shrink-0 rounded-xl ring-1 ring-black/10" />
        )}
        <div className="w-full min-w-0 space-y-2 text-sm">
          <p className="font-bold">Como pagar:</p>
          <ol className="list-decimal space-y-0.5 pl-5 text-gray-700">
            <li>Abra o app do seu banco e escolha <strong>Pix</strong>.</li>
            <li>Leia o QR code ou use <strong>Pix copia e cola</strong>.</li>
            <li>Confirme o pagamento. Esta página atualiza sozinha.</li>
          </ol>
          <textarea id="pix-codigo" readOnly value={copiaECola} rows={3} className="campo w-full resize-none font-mono text-xs break-all" onFocus={(e) => e.currentTarget.select()} aria-label="Código Pix copia e cola" />
          <button type="button" onClick={copiar} className="w-full rounded-2xl bg-marca-azul py-3 text-base font-bold text-white shadow hover:bg-marca-azul-escuro">
            {copiado ? "✓ Código copiado" : "Copiar código Pix"}
          </button>
          <p className="text-center text-xs text-gray-500">
            {restante > 0 ? `Este Pix vale por mais ${min}:${String(seg).padStart(2, "0")}` : "Este Pix expirou. Gere um novo abaixo."}
          </p>
        </div>
      </div>
    </div>
  );
}
