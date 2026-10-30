import type { FormaPagamento, StatusPedido } from "@/db/schema";

export const ROTULO_PAGAMENTO: Record<FormaPagamento, string> = {
  online_pix: "Pix",
  online_cartao: "Cartão de crédito ou débito",
  entrega_dinheiro: "Dinheiro",
  entrega_maquininha: "Maquininha na entrega",
  // Usadas antes da mudança para pagamento no site; aparecem só em pedidos antigos.
  entrega_pix: "Pix na entrega",
  entrega_credito: "Crédito na entrega",
  entrega_debito: "Débito na entrega",
  entrega_vr: "Vale-refeição na entrega",
};

/** As quatro formas que a loja pode oferecer, na ordem em que aparecem para o cliente. */
export const FORMAS_OFERECIDAS = ["online_pix", "online_cartao", "entrega_dinheiro", "entrega_maquininha"] as const satisfies readonly FormaPagamento[];

export const DETALHE_PAGAMENTO: Record<(typeof FORMAS_OFERECIDAS)[number], { icone: string; texto: string }> = {
  online_pix: { icone: "⚡", texto: "Pague agora pelo Mercado Pago, aprovação na hora" },
  online_cartao: { icone: "💳", texto: "Pague agora pelo Mercado Pago, com segurança" },
  entrega_dinheiro: { icone: "💵", texto: "Pague ao entregador; informe se precisa de troco" },
  entrega_maquininha: { icone: "📟", texto: "O entregador leva a maquininha (crédito, débito ou vale-refeição)" },
};

export const ROTULO_STATUS: Record<StatusPedido, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  novo: "Novo",
  em_separacao: "Em separação",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

/** Para onde cada situação pode ir. Pedido entregue ou cancelado não volta. */
export const PROXIMOS_STATUS: Record<StatusPedido, StatusPedido[]> = {
  aguardando_pagamento: ["cancelado"],
  novo: ["em_separacao", "cancelado"],
  em_separacao: ["saiu_entrega", "cancelado"],
  saiu_entrega: ["entregue", "cancelado"],
  entregue: [],
  cancelado: [],
};

export function pagamentoOnline(forma: FormaPagamento): boolean {
  return forma.startsWith("online_");
}

/** Itens vendidos por peso: o cliente escolhe o valor em reais dentro deste intervalo. */
export const VALOR_MIN_PESO = 5;
export const VALOR_MAX_PESO = 500;
export const QTD_MAX_UNIDADES = 99;
export const MAX_ITENS_PEDIDO = 150;

/** "(62) 98177-9460", "62981779460" → "5562981779460". Vazio se não parecer um celular/fixo brasileiro. */
export function normalizarTelefone(bruto: string): string {
  let d = bruto.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return "";
  return `55${d}`;
}

/** "5562981779460" → "(62) 98177-9460" */
export function telefoneBR(normalizado: string): string {
  const d = normalizado.replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return normalizado;
}

/** 0,5 → "0,500 kg" */
export function quilos(q: number): string {
  return `${q.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
}
