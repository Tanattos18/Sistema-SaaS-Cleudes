import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assinaturaValida, corpoPix, corpoPreferencia, decidir, emailDoPedido, ordemComoPagamento, type PagamentoMP } from "./mercadopago";
import { cifrar, decifrar } from "./segredo";

const pedido = { numero: 7, codigo: "abc123", total: 189.98 };
const loja = { nome: "Supermercado Caixeta", slug: "caixeta" };
const agora = new Date("2026-10-29T15:00:00Z");

describe("preferência do Mercado Pago", () => {
  it("Pix: só transferência (Pix), valor total, volta para o pedido e expira em 30 min", () => {
    const c = corpoPreferencia(pedido, loja, "online_pix", "https://loja.com.br", agora);
    expect(c.items).toEqual([{ id: "abc123", title: "Pedido nº 7 - Supermercado Caixeta", quantity: 1, unit_price: 189.98, currency_id: "BRL" }]);
    expect(c.external_reference).toBe("abc123");
    expect(c.notification_url).toBe("https://loja.com.br/api/pagamentos/mercadopago/caixeta");
    expect(c.back_urls.success).toBe("https://loja.com.br/caixeta/pedido/abc123");
    expect(c.payment_methods.excluded_payment_types.map((t) => t.id)).toContain("credit_card");
    expect(c.payment_methods.excluded_payment_types.map((t) => t.id)).not.toContain("bank_transfer");
    expect(c.payment_methods).toMatchObject({ default_payment_method_id: "pix", installments: 1 });
    expect(c.expiration_date_to).toBe("2026-10-29T15:30:00.000Z");
  });

  it("Cartão: crédito e débito, sem Pix nem boleto", () => {
    const tipos = corpoPreferencia(pedido, loja, "online_cartao", "https://loja.com.br", agora).payment_methods.excluded_payment_types.map((t) => t.id);
    expect(tipos).toEqual(expect.arrayContaining(["bank_transfer", "ticket"]));
    expect(tipos).not.toContain("credit_card");
    expect(tipos).not.toContain("debit_card");
  });
});

describe("confirmação do pagamento", () => {
  const aguardando = { codigo: "abc123", total: 189.98, status: "aguardando_pagamento", pagoEm: null };
  const pg = (x: Partial<PagamentoMP>): PagamentoMP => ({ id: 1, status: "approved", external_reference: "abc123", transaction_amount: 189.98, ...x });

  it("aprova só pagamento aprovado, do mesmo pedido e com o valor certo", () => {
    expect(decidir(aguardando, pg({}))).toBe("aprovar");
    expect(decidir(aguardando, pg({ status: "pending" }))).toBe("ignorar");
    expect(decidir(aguardando, pg({ status: "rejected" }))).toBe("ignorar");
    expect(decidir(aguardando, pg({ external_reference: "outro" }))).toBe("outro_pedido");
    expect(decidir(aguardando, pg({ transaction_amount: 1 }))).toBe("valor_diferente");
  });

  it("notificação repetida não aprova de novo", () => {
    expect(decidir({ ...aguardando, status: "novo", pagoEm: new Date() }, pg({}))).toBe("ignorar");
  });
});

describe("credencial guardada criptografada", () => {
  it("cifra e decifra; valor adulterado não abre", () => {
    const c = cifrar("APP_USR-123-segredo");
    expect(c).not.toContain("APP_USR");
    expect(decifrar(c)).toBe("APP_USR-123-segredo");
    expect(decifrar(c.slice(0, -2) + "xx")).toBeNull();
    expect(decifrar("texto-qualquer")).toBeNull();
    expect(decifrar(null)).toBeNull();
  });
});

describe("Pix gerado no site (API de Orders, como na Akylla Shop)", () => {
  it("monta a ordem com o total, a referência do pedido e 30 minutos para pagar", () => {
    const c = corpoPix(pedido, loja, emailDoPedido("abc_123", "https://loja.com.br"));
    expect(c).toMatchObject({ type: "online", processing_mode: "automatic", total_amount: "189.98", external_reference: "abc123" });
    expect(c.transactions.payments[0]).toEqual({ amount: "189.98", payment_method: { id: "pix", type: "bank_transfer" }, expiration_time: "PT30M" });
    expect(c.payer.email).toBe("pedido+abc123@loja.com.br");
  });

  it("traduz a situação da ordem: paga, aberta ou encerrada", () => {
    const base = { id: "ORD1", total_amount: "189.98", external_reference: "abc123", transactions: { payments: [{ id: "PAY1" }] } };
    expect(ordemComoPagamento({ ...base, status: "processed", status_detail: "accredited" })).toMatchObject({ id: "PAY1", status: "approved", transaction_amount: 189.98 });
    expect(ordemComoPagamento({ ...base, status: "action_required" }).status).toBe("pending");
    expect(ordemComoPagamento({ ...base, status: "expired" }).status).toBe("cancelled");
    expect(decidir({ codigo: "abc123", total: 189.98, status: "aguardando_pagamento", pagoEm: null }, ordemComoPagamento({ ...base, status: "processed" }))).toBe("aprovar");
  });
});

describe("assinatura do webhook", () => {
  const segredo = "segredo-de-teste-123456";
  const assinar = (manifesto: string) => createHmac("sha256", segredo).update(manifesto).digest("hex");

  it("aceita a assinatura certa e recusa a errada ou ausente", () => {
    const v1 = assinar("id:ord01abc;request-id:req-9;ts:1700000000;");
    expect(assinaturaValida(segredo, `ts=1700000000,v1=${v1}`, "req-9", "ORD01ABC")).toBe(true);
    expect(assinaturaValida(segredo, `ts=1700000001,v1=${v1}`, "req-9", "ORD01ABC")).toBe(false);
    expect(assinaturaValida(segredo, null, "req-9", "ORD01ABC")).toBe(false);
  });

  it("sem segredo cadastrado, deixa passar (o pagamento é conferido na API de qualquer jeito)", () => {
    expect(assinaturaValida(null, null, null, "1")).toBe(true);
  });
});
