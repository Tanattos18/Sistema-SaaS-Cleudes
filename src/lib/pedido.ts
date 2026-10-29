import type { FormaPagamento } from "@/db/schema";
import { centavos } from "./formato";
import { MAX_ITENS_PEDIDO, QTD_MAX_UNIDADES, VALOR_MAX_PESO, VALOR_MIN_PESO } from "./dominio";

/** O que o navegador envia. Preços nunca vêm do cliente: tudo é recalculado com o catálogo. */
export type ItemCarrinho = {
  produtoId: number;
  /** Unidades (produtos "un"). */
  quantidade?: number;
  /** Valor em reais (produtos "kg"). */
  valor?: number;
  /** Gás: tem o botijão vazio para troca? */
  temVasilhame?: boolean;
  observacao?: string;
};

export type ProdutoCatalogo = {
  id: number;
  nome: string;
  unidade: "un" | "kg";
  preco: number;
  precoVasilhame: number | null;
  disponivel: boolean;
  ativo: boolean;
};

export type RegrasLoja = {
  pedidoMinimo: number;
  modoTaxa: "fixa" | "bairro";
  taxaFixa: number;
  freteGratisAcima: number | null;
  formasPagamento: FormaPagamento[];
};

export type ItemCalculado = {
  produtoId: number;
  nome: string;
  unidade: "un" | "kg";
  quantidade: number;
  precoUnitario: number;
  temVasilhame: boolean | null;
  precoVasilhame: number | null;
  total: number;
  observacao: string | null;
};

export type PedidoCalculado = {
  itens: ItemCalculado[];
  subtotal: number;
  taxaEntrega: number;
  total: number;
};

export function calcularItem(item: ItemCarrinho, p: ProdutoCatalogo | undefined): ItemCalculado | string {
  if (!p || !p.ativo) return "Um dos produtos do carrinho não está mais à venda. Remova-o e tente de novo.";
  if (!p.disponivel) return `"${p.nome}" acabou de ficar indisponível. Remova-o do carrinho.`;
  const observacao = item.observacao?.trim().slice(0, 200) || null;

  if (p.unidade === "kg") {
    const valor = item.valor ?? 0;
    if (!(valor >= VALOR_MIN_PESO && valor <= VALOR_MAX_PESO)) {
      return `"${p.nome}": escolha um valor entre R$ ${VALOR_MIN_PESO} e R$ ${VALOR_MAX_PESO}.`;
    }
    const v = centavos(valor);
    // O cliente paga o valor escolhido; a quantidade é a estimativa para o açougueiro.
    return {
      produtoId: p.id,
      nome: p.nome,
      unidade: "kg",
      quantidade: Math.round((v / p.preco) * 1000) / 1000,
      precoUnitario: p.preco,
      temVasilhame: null,
      precoVasilhame: null,
      total: v,
      observacao,
    };
  }

  const qtd = item.quantidade ?? 0;
  if (!Number.isInteger(qtd) || qtd < 1 || qtd > QTD_MAX_UNIDADES) {
    return `"${p.nome}": quantidade inválida.`;
  }
  const gas = p.precoVasilhame != null;
  if (gas && typeof item.temVasilhame !== "boolean") {
    return `"${p.nome}": informe se você tem o botijão vazio para troca.`;
  }
  const vasilhame = gas && !item.temVasilhame ? p.precoVasilhame! : 0;
  return {
    produtoId: p.id,
    nome: p.nome,
    unidade: "un",
    quantidade: qtd,
    precoUnitario: p.preco,
    temVasilhame: gas ? item.temVasilhame! : null,
    precoVasilhame: gas ? p.precoVasilhame : null,
    total: centavos((p.preco + vasilhame) * qtd),
    observacao,
  };
}

/** Taxa de entrega: fixa ou do bairro, zerada quando o subtotal atinge o frete grátis. */
export function calcularTaxa(regras: RegrasLoja, subtotal: number, taxaBairro: number | null): number | string {
  if (regras.freteGratisAcima != null && subtotal >= regras.freteGratisAcima) return 0;
  if (regras.modoTaxa === "bairro") {
    if (taxaBairro == null) return "Ainda não entregamos nesse bairro.";
    return taxaBairro;
  }
  return regras.taxaFixa;
}

export function calcularPedido(
  itens: ItemCarrinho[],
  produtos: Map<number, ProdutoCatalogo>,
  regras: RegrasLoja,
  taxaBairro: number | null,
): PedidoCalculado | string {
  if (itens.length === 0) return "O carrinho está vazio.";
  if (itens.length > MAX_ITENS_PEDIDO) return "Pedido com itens demais.";

  const calculados: ItemCalculado[] = [];
  for (const item of itens) {
    const r = calcularItem(item, produtos.get(item.produtoId));
    if (typeof r === "string") return r;
    calculados.push(r);
  }
  const subtotal = centavos(calculados.reduce((s, i) => s + i.total, 0));
  if (subtotal < regras.pedidoMinimo) {
    return `O pedido mínimo para entrega é de R$ ${regras.pedidoMinimo.toFixed(2).replace(".", ",")}.`;
  }
  const taxa = calcularTaxa(regras, subtotal, taxaBairro);
  if (typeof taxa === "string") return taxa;
  return { itens: calculados, subtotal, taxaEntrega: taxa, total: centavos(subtotal + taxa) };
}

/** Confere a forma de pagamento escolhida e o troco. */
export function validarPagamento(
  regras: RegrasLoja,
  forma: FormaPagamento,
  total: number,
  trocoPara: number | null,
  mercadoPagoConfigurado: boolean,
): string | null {
  if (!regras.formasPagamento.includes(forma)) return "Forma de pagamento não aceita por esta loja.";
  if (forma.startsWith("online_") && !mercadoPagoConfigurado) return "Pagamento pelo site indisponível no momento.";
  if (forma === "entrega_dinheiro" && trocoPara != null && trocoPara < total) {
    return "O valor para troco precisa ser maior que o total do pedido.";
  }
  return null;
}
