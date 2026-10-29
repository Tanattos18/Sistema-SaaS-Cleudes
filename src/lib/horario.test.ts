import { describe, expect, it } from "vitest";
import { situacaoLoja, type Horario } from "./horario";

// Seg–sáb 06:00–20:00, domingo 06:00–11:00 (horário da Caixeta).
const horarios: Horario[] = [
  { diaSemana: 0, abre: "06:00", fecha: "11:00" },
  ...[1, 2, 3, 4, 5, 6].map((d) => ({ diaSemana: d, abre: "06:00", fecha: "20:00" })),
];
// Datas em UTC; Brasília = UTC−3. 2026-11-01 é domingo.
const em = (iso: string) => new Date(`${iso}-03:00`);

describe("horário de funcionamento", () => {
  it("aberta dentro do horário", () => {
    expect(situacaoLoja(horarios, em("2026-11-02T10:00:00"))).toEqual({ aberta: true, mensagem: "Aberto até 20:00" });
  });

  it("fecha no horário exato e informa a próxima abertura", () => {
    expect(situacaoLoja(horarios, em("2026-11-02T20:00:00"))).toEqual({ aberta: false, mensagem: "Fechado agora. Abre amanhã às 06:00" });
    expect(situacaoLoja(horarios, em("2026-11-02T05:30:00")).mensagem).toBe("Fechado agora. Abre hoje às 06:00");
  });

  it("domingo fecha às 11h", () => {
    expect(situacaoLoja(horarios, em("2026-11-01T10:59:00")).aberta).toBe(true);
    expect(situacaoLoja(horarios, em("2026-11-01T11:00:00")).aberta).toBe(false);
  });

  it("pula dias sem expediente", () => {
    const soSegunda = [{ diaSemana: 1, abre: "08:00", fecha: "12:00" }];
    expect(situacaoLoja(soSegunda, em("2026-11-04T09:00:00")).mensagem).toBe("Fechado agora. Abre segunda às 08:00");
    expect(situacaoLoja([], em("2026-11-04T09:00:00")).aberta).toBe(false);
  });
});
