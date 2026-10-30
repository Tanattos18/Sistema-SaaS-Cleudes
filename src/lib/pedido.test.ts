import { describe, expect, it } from "vitest";
import { calcularPedido, validarPagamento, type ProdutoCatalogo, type RegrasLoja } from "./pedido";
import { normalizarTelefone } from "./dominio";

const P = (p: Partial<ProdutoCatalogo> & { id: number; preco: number }): ProdutoCatalogo => ({
  nome: `Produto ${p.id}`, unidade: "un", precoVasilhame: null, disponivel: true, ativo: true, ...p,
});
const catalogo = new Map<number, ProdutoCatalogo>([
  [1, P({ id: 1, nome: "Arroz 5kg", preco: 27.9 })],
  [2, P({ id: 2, nome: "Carne moída", unidade: "kg", preco: 39.9 })],
  [3, P({ id: 3, nome: "Gás P13", preco: 120, precoVasilhame: 180 })],
  [4, P({ id: 4, preco: 10, disponivel: false })],
]);
const regras: RegrasLoja = {
  pedidoMinimo: 40, modoTaxa: "fixa", taxaFixa: 5, freteGratisAcima: 150,
  formasPagamento: ["entrega_pix", "entrega_dinheiro", "online_pix"],
};

describe("cálculo do pedido", () => {
  it("soma unidades, valor por peso e taxa fixa", () => {
    const r = calcularPedido([{ produtoId: 1, quantidade: 2 }, { produtoId: 2, valor: 20 }], catalogo, regras, null);
    if (typeof r === "string") throw new Error(r);
    expect(r.subtotal).toBe(75.8);
    expect(r.taxaEntrega).toBe(5);
    expect(r.total).toBe(80.8);
    // R$ 20 de carne a R$ 39,90/kg ≈ 0,501 kg; o cliente paga os R$ 20.
    expect(r.itens[1]).toMatchObject({ quantidade: 0.501, total: 20 });
  });

  it("gás: troca cobra só o gás; sem vasilhame cobra o botijão também", () => {
    const troca = calcularPedido([{ produtoId: 3, quantidade: 1, temVasilhame: true }], catalogo, regras, null);
    const sem = calcularPedido([{ produtoId: 3, quantidade: 1, temVasilhame: false }], catalogo, regras, null);
    expect(typeof troca !== "string" && troca.subtotal).toBe(120);
    expect(typeof sem !== "string" && sem.subtotal).toBe(300);
    expect(calcularPedido([{ produtoId: 3, quantidade: 1 }], catalogo, regras, null)).toMatch(/botijão vazio/);
  });

  it("frete grátis a partir do valor configurado", () => {
    const r = calcularPedido([{ produtoId: 3, quantidade: 1, temVasilhame: false }], catalogo, regras, null);
    expect(typeof r !== "string" && r.taxaEntrega).toBe(0);
  });

  it("recusa pedido abaixo do mínimo, produto indisponível e valores inválidos", () => {
    expect(calcularPedido([{ produtoId: 1, quantidade: 1 }], catalogo, regras, null)).toMatch(/mínimo/);
    expect(calcularPedido([{ produtoId: 4, quantidade: 5 }], catalogo, regras, null)).toMatch(/indisponível/);
    expect(calcularPedido([{ produtoId: 99, quantidade: 5 }], catalogo, regras, null)).toMatch(/não está mais à venda/);
    expect(calcularPedido([{ produtoId: 1, quantidade: 1.5 }], catalogo, regras, null)).toMatch(/quantidade/);
    expect(calcularPedido([{ produtoId: 2, valor: 2 }], catalogo, regras, null)).toMatch(/valor entre/);
    expect(calcularPedido([], catalogo, regras, null)).toMatch(/vazio/);
  });

  it("taxa por bairro: bairro fora da lista não é atendido", () => {
    const porBairro = { ...regras, modoTaxa: "bairro" as const };
    const itens = [{ produtoId: 1, quantidade: 2 }];
    expect(calcularPedido(itens, catalogo, porBairro, null)).toMatch(/bairro/);
    const r = calcularPedido(itens, catalogo, porBairro, 8);
    expect(typeof r !== "string" && r.taxaEntrega).toBe(8);
  });
});

describe("pagamento", () => {
  it("aceita só as formas ligadas pela loja e exige Mercado Pago para pagar no site", () => {
    expect(validarPagamento(regras, "entrega_pix", 50, null, false)).toBeNull();
    expect(validarPagamento(regras, "entrega_vr", 50, null, false)).toMatch(/não aceita/);
    expect(validarPagamento(regras, "online_pix", 50, null, false)).toMatch(/indisponível/);
    expect(validarPagamento(regras, "online_pix", 50, null, true)).toBeNull();
  });

  it("troco precisa ser maior que o total", () => {
    expect(validarPagamento(regras, "entrega_dinheiro", 80, 50, false)).toMatch(/troco/);
    expect(validarPagamento(regras, "entrega_dinheiro", 80, 100, false)).toBeNull();
  });
});

describe("telefone", () => {
  it("normaliza para o formato do WhatsApp", () => {
    expect(normalizarTelefone("(62) 8151-7002")).toBe("556281517002");
    expect(normalizarTelefone("+55 62 99999-0000")).toBe("5562999990000");
    expect(normalizarTelefone("1234")).toBe("");
  });
});
