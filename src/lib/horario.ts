export type Horario = { diaSemana: number; abre: string; fecha: string };
export type SituacaoLoja = { aberta: boolean; mensagem: string };

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Dia da semana (0 = domingo) e hora "HH:MM" no fuso de Brasília. */
export function agoraBrasilia(agora = new Date()): { dia: number; hora: string } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(agora);
  const p = (t: string) => partes.find((x) => x.type === t)!.value;
  const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p("weekday"));
  return { dia, hora: `${p("hour")}:${p("minute")}` };
}

/**
 * A loja aceita pedidos só dentro do horário cadastrado. Fora dele, diz quando abre de novo.
 * Horários que viram a meia-noite não são suportados (fecha precisa ser depois de abre).
 */
export function situacaoLoja(horarios: Horario[], agora = new Date()): SituacaoLoja {
  const { dia, hora } = agoraBrasilia(agora);
  const doDia = (d: number) => horarios.filter((h) => h.diaSemana === d).sort((a, b) => a.abre.localeCompare(b.abre));

  const hoje = doDia(dia);
  const atual = hoje.find((h) => hora >= h.abre && hora < h.fecha);
  if (atual) return { aberta: true, mensagem: `Aberto até ${atual.fecha}` };

  const maisTarde = hoje.find((h) => h.abre > hora);
  if (maisTarde) return { aberta: false, mensagem: `Fechado agora. Abre hoje às ${maisTarde.abre}` };

  for (let i = 1; i <= 7; i++) {
    const d = (dia + i) % 7;
    const [prox] = doDia(d);
    if (prox) {
      const quando = i === 1 ? "amanhã" : DIAS[d];
      return { aberta: false, mensagem: `Fechado agora. Abre ${quando} às ${prox.abre}` };
    }
  }
  return { aberta: false, mensagem: "Fechado no momento" };
}
