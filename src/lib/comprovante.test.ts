import { describe, expect, it } from "vitest";
import { COLUNAS, colunas, montarComprovante, quebrar } from "./comprovante";
import type { PedidoCompleto } from "./consultas";

const item = (x: Partial<PedidoCompleto["itens"][number]>): PedidoCompleto["itens"][number] => ({
  id: 1, pedidoId: 1, produtoId: 1, nome: "Item", unidade: "un", quantidade: 1, precoUnitario: 10,
  temVasilhame: null, precoVasilhame: null, total: 10, observacao: null, ...x,
});

const pedido: PedidoCompleto = {
  id: 1, lojaId: 1, numero: 12, codigo: "abc", status: "novo",
  clienteNome: "Maria Teste", clienteTelefone: "5562999991234",
  rua: "Rua das Flores com um nome bem comprido para quebrar", numeroEndereco: "120", complemento: "Qd 3 Lt 5",
  bairro: "Centro", bairroId: null, referencia: "Perto da praça", observacoes: "Tocar a campainha",
  formaPagamento: "entrega_dinheiro", trocoPara: 250, subtotal: 195.8, taxaEntrega: 0, total: 195.8,
  pagoEm: null, mpPreferenciaId: null, mpPagamentoId: null, impressoEm: null, canceladoMotivo: null,
  criadoEm: new Date("2026-10-29T17:09:00Z"),
  itens: [
    item({ nome: "Arroz tipo 1 5kg", quantidade: 2, precoUnitario: 27.9, total: 55.8 }),
    item({ nome: "Carne moída de primeira", unidade: "kg", quantidade: 0.501, precoUnitario: 39.9, total: 20, observacao: "moer duas vezes" }),
    item({ nome: "Gás de cozinha P13 (13 kg)", quantidade: 1, precoUnitario: 120, temVasilhame: true, precoVasilhame: 180, total: 120 }),
  ],
};

describe("comprovante para a impressora térmica", () => {
  it("nenhuma linha passa da largura da bobina", () => {
    for (const l of montarComprovante("Supermercado Caixeta", pedido)) {
      expect(l.texto.length, l.texto).toBeLessThanOrEqual(l.grande ? COLUNAS / 2 : COLUNAS);
    }
  });

  it("traz o que a separação e o entregador precisam", () => {
    const texto = montarComprovante("Supermercado Caixeta", pedido).map((l) => l.texto).join("\n");
    expect(texto).toContain("PEDIDO Nº 12");
    expect(texto).toContain("29/10/2026 14:09");
    expect(texto).toMatch(/\[ \] 2x Arroz tipo 1 5kg +R\$ 55,80/);
    expect(texto).toContain("PESAR ~0,501 kg (R$ 39,90/kg)");
    expect(texto).toContain("obs.: moer duas vezes");
    expect(texto).toContain("TROCA: cliente tem o botijão vazio");
    expect(texto).toContain("BAIRRO: Centro");
    expect(texto).toContain("LEVAR TROCO: R$ 54,20 (para R$ 250,00)");
    expect(texto).toContain("OBSERVAÇÕES: Tocar a campainha");
  });

  it("pedido pago no site aparece destacado e sem maquininha", () => {
    const pago = { ...pedido, formaPagamento: "online_pix" as const, trocoPara: null, pagoEm: new Date() };
    const texto = montarComprovante("Loja", pago).map((l) => l.texto).join("\n");
    expect(texto).toContain("*** PAGO PELO SITE ***");
    expect(texto).not.toContain("maquininha");
  });

  it("quebra textos longos e alinha valores à direita", () => {
    expect(quebrar("um dois três quatro", 9, "  ")).toEqual(["um dois", "  três", "  quatro"]);
    expect(quebrar("abcdefghijkl", 5)).toEqual(["abcde", "fghij", "kl"]);
    expect(colunas("Subtotal", "R$ 10,00", 20)).toEqual(["Subtotal    R$ 10,00"]);
    expect(colunas("[ ] Produto de nome muito comprido", "R$ 1,00", 24, "    ")).toEqual(["[ ] Produto de", "    nome muito", "    comprido     R$ 1,00"]);
  });
});
