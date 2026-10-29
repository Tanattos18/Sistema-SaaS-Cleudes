"use client";

import Link from "next/link";
import { useActionState } from "react";
import { dataBR } from "@/lib/formato";
import { importarPlanilha, type EstadoImportacao } from "./actions";

export function FormularioImportacao({ amanha, hoje }: { amanha: string; hoje: string }) {
  const [estado, enviar, pendente] = useActionState<EstadoImportacao, FormData>(importarPlanilha, {});
  return (
    <>
      <form action={enviar} className="cartao space-y-4">
        <label className="block">
          <span className="rotulo">Planilha (.xlsx ou .csv)</span>
          <input name="arquivo" type="file" accept=".xlsx,.csv,.txt" required className="campo file:mr-3 file:rounded file:border-0 file:bg-marca-azul-claro file:px-3 file:py-1 file:text-marca-azul" />
        </label>
        <fieldset className="space-y-2 text-sm">
          <legend className="rotulo">Quando os preços novos valem</legend>
          <label className="flex items-center gap-2"><input type="radio" name="quando" value="agora" defaultChecked /> Agora, na hora da importação</label>
          <label className="flex flex-wrap items-center gap-2">
            <input type="radio" name="quando" value="data" /> A partir de
            <input type="date" name="vigenteEm" defaultValue={amanha} min={hoje} className="campo w-auto" />
            <span className="text-xs text-gray-500">(produtos novos e os outros dados entram na hora)</span>
          </label>
        </fieldset>
        <button className="botao" disabled={pendente}>{pendente ? "Importando…" : "Importar produtos"}</button>
      </form>

      {estado.erros && (
        <div className="cartao mt-4 border-red-200 bg-red-50 text-sm text-red-800" role="alert">
          <p className="mb-2 font-semibold">Nada foi importado. Corrija a planilha e envie de novo:</p>
          <ul className="list-disc space-y-1 pl-5">
            {estado.erros.slice(0, 50).map((e) => <li key={e}>{e}</li>)}
          </ul>
          {estado.erros.length > 50 && <p className="mt-2">… e mais {estado.erros.length - 50} linha(s) com problema.</p>}
        </div>
      )}
      {estado.resumo && (
        <div className="cartao mt-4 border-green-200 bg-green-50 text-sm text-green-900">
          <p className="font-semibold">Importação concluída.</p>
          <ul className="mt-1 list-disc pl-5">
            <li>{estado.resumo.criados} produto(s) novo(s)</li>
            <li>{estado.resumo.atualizados} produto(s) atualizado(s)</li>
            {estado.resumo.agendados > 0 && <li>{estado.resumo.agendados} preço(s) agendado(s) para {dataBR(estado.vigenteEm)}</li>}
            {estado.resumo.categoriasNovas.length > 0 && <li>Categorias criadas: {estado.resumo.categoriasNovas.join(", ")}</li>}
          </ul>
          <Link href="/painel/produtos" className="link mt-2 inline-block">Ver produtos →</Link>
        </div>
      )}
    </>
  );
}
