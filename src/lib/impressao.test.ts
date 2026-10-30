import { describe, expect, it } from "vitest";
import { impressoraConectada, impressoraDoPainel } from "./impressao";

const base = { impressoraTipo: null, impressoraNome: null, impressoraIp: null, impressoraPorta: null, impressoraCopias: 1 } as const;

describe("impressora escolhida no painel", () => {
  it("sem escolha (ou incompleta), o programa usa o config.json", () => {
    expect(impressoraDoPainel(base)).toBeNull();
    expect(impressoraDoPainel({ ...base, impressoraTipo: "comum" })).toBeNull();
    expect(impressoraDoPainel({ ...base, impressoraTipo: "rede" })).toBeNull();
  });

  it("impressora do Windows (térmica ou comum) vai com o nome e as vias", () => {
    expect(impressoraDoPainel({ ...base, impressoraTipo: "comum", impressoraNome: "\\FGRWPS01\HP", impressoraCopias: 2 })).toEqual({
      tipo: "comum", nome: "\\FGRWPS01\HP", ip: null, porta: 9100, copias: 2,
    });
  });

  it("térmica de rede vai com IP e porta", () => {
    expect(impressoraDoPainel({ ...base, impressoraTipo: "rede", impressoraIp: "192.168.0.50", impressoraPorta: 9101 })).toMatchObject({ tipo: "rede", ip: "192.168.0.50", porta: 9101 });
  });

  it("conectada só com contato nos últimos 30 segundos", () => {
    const agora = new Date("2026-10-30T12:00:30Z");
    expect(impressoraConectada(new Date("2026-10-30T12:00:10Z"), agora)).toBe(true);
    expect(impressoraConectada(new Date("2026-10-30T11:59:00Z"), agora)).toBe(false);
    expect(impressoraConectada(null, agora)).toBe(false);
  });
});
