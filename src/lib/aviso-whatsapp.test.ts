import { describe, expect, it } from "vitest";
import { LIMITE_TEXTO, textoDoAviso, urlCallMeBot } from "./aviso-whatsapp";

describe("aviso no WhatsApp da loja (CallMeBot)", () => {
  it("monta a chamada com o número, o texto e a chave", () => {
    const u = new URL(urlCallMeBot("556281517002", "123456", "Pedido nº 1 & mais"));
    expect(u.pathname).toBe("/whatsapp.php");
    expect(u.searchParams.get("phone")).toBe("556281517002");
    expect(u.searchParams.get("text")).toBe("Pedido nº 1 & mais");
    expect(u.searchParams.get("apikey")).toBe("123456");
  });

  it("pedido curto vai inteiro; pedido longo é resumido com o link", () => {
    expect(textoDoAviso("*Pedido nº 5*", "https://x/p")).toBe("🛒 *NOVO PEDIDO PELO SITE*\n\n*Pedido nº 5*");
    const longo = Array.from({ length: 200 }, (_, i) => `• 1x Produto ${i}: R$ 1,00`).join("\n");
    const t = textoDoAviso(longo, "https://x/p");
    expect(t.length).toBeLessThanOrEqual(LIMITE_TEXTO);
    expect(t).toContain("https://x/p");
  });
});
