import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { hojeISO, somarDias } from "@/lib/formato";
import { Cabecalho } from "@/components/ui";
import { FormularioImportacao } from "./formulario";

export const metadata = { title: "Importar planilha — Painel" };

export default async function ImportarPage() {
  await exigirUsuario();
  const hoje = hojeISO();
  return (
    <div className="max-w-3xl">
      <Link href="/painel/produtos" className="link text-sm">← Produtos</Link>
      <Cabecalho
        titulo="Importar planilha de produtos"
        descricao="Cadastra os produtos novos e atualiza os existentes (pelo código ou, sem código, pelo nome)."
        acoes={<a href="/painel/produtos/modelo" download className="botao-sec">Baixar planilha modelo</a>}
      />
      <div className="cartao mb-4 text-sm text-gray-700">
        <p className="mb-2 font-semibold">Colunas da planilha (a primeira linha é o cabeçalho):</p>
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <li><strong>nome</strong>, <strong>categoria</strong> e <strong>preço</strong>: obrigatórias</li>
          <li><strong>código</strong>: do caixa ou de barras (recomendado)</li>
          <li><strong>unidade</strong>: un ou kg (vazio = un)</li>
          <li><strong>preço de</strong>: preço antigo riscado, em promoção</li>
          <li><strong>vasilhame</strong>: só gás e galão de água</li>
          <li><strong>disponível</strong>: sim ou não (vazio = sim)</li>
        </ul>
        <p className="mt-2 text-xs text-gray-500">Se alguma linha tiver problema, nada é gravado e a lista de erros aparece abaixo, com o número da linha.</p>
      </div>
      <FormularioImportacao hoje={hoje} amanha={somarDias(hoje, 1)} />
    </div>
  );
}
