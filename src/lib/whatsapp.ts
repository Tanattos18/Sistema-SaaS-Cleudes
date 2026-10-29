import type { FormaPagamento } from "@/db/schema";
import { ROTULO_PAGAMENTO, quilos, telefoneBR } from "./dominio";
import { moeda } from "./formato";

export type PedidoMensagem = {
  numero: number;
  clienteNome: string;
  clienteTelefone: string;
  rua: string;
  numeroEndereco: string;
  complemento: string | null;
  bairro: string;
  referencia: string | null;
  observacoes: string | null;
  formaPagamento: FormaPagamento;
  trocoPara: number | null;
  pago: boolean;
  subtotal: number;
  taxaEntrega: number;
  total: number;
  itens: {
    nome: string;
    unidade: "un" | "kg";
    quantidade: number;
    precoUnitario: number;
    temVasilhame: boolean | null;
    total: number;
    observacao: string | null;
  }[];
};

export function linhaItem(i: PedidoMensagem["itens"][number]): string {
  if (i.unidade === "kg") {
    return `${i.nome}: ${moeda(i.total)} (≈ ${quilos(i.quantidade)} a ${moeda(i.precoUnitario)}/kg)`;
  }
  const gas = i.temVasilhame == null ? "" : i.temVasilhame ? " [troca: tem o vazio]" : " [sem vasilhame: leva o botijão]";
  return `${i.quantidade}x ${i.nome}${gas}: ${moeda(i.total)}`;
}

/** Texto do pedido enviado ao WhatsApp da loja (negrito do WhatsApp com *asteriscos*). */
export function mensagemPedido(p: PedidoMensagem, linkAcompanhamento: string): string {
  const linhas = [
    `*Pedido nº ${p.numero}*`,
    "",
    ...p.itens.flatMap((i) => [`• ${linhaItem(i)}`, ...(i.observacao ? [`   _obs.: ${i.observacao}_`] : [])]),
    "",
    `Subtotal: ${moeda(p.subtotal)}`,
    `Entrega: ${p.taxaEntrega === 0 ? "grátis" : moeda(p.taxaEntrega)}`,
    `*Total: ${moeda(p.total)}*`,
  ];
  if (p.itens.some((i) => i.unidade === "kg")) linhas.push("_Itens por peso: valor aproximado, conferido na pesagem._");
  linhas.push(
    "",
    `*Pagamento:* ${ROTULO_PAGAMENTO[p.formaPagamento]}${p.pago ? " (PAGO)" : ""}`,
  );
  if (p.formaPagamento === "entrega_dinheiro") {
    linhas.push(p.trocoPara ? `Troco para ${moeda(p.trocoPara)}` : "Não precisa de troco");
  }
  linhas.push(
    "",
    `*Cliente:* ${p.clienteNome}`,
    `*Telefone:* ${telefoneBR(p.clienteTelefone)}`,
    `*Endereço:* ${p.rua}, ${p.numeroEndereco}${p.complemento ? ` - ${p.complemento}` : ""} - ${p.bairro}`,
  );
  if (p.referencia) linhas.push(`*Referência:* ${p.referencia}`);
  if (p.observacoes) linhas.push(`*Observações:* ${p.observacoes}`);
  linhas.push("", `Acompanhar: ${linkAcompanhamento}`);
  return linhas.join("\n");
}

export function linkWhatsApp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
