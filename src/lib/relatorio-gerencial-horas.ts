type HorarioInput = {
  horaChegada: Date | string;
  horaSaida: Date | string;
};

function parseDate(value: Date | string): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Soma durações chegada→saída em horas decimais (ex.: 1.5 = 1h30). */
export function calcularTotalHorasDecimal(horarios: HorarioInput[]): number {
  let totalMs = 0;

  for (const h of horarios) {
    const chegada = parseDate(h.horaChegada);
    const saida = parseDate(h.horaSaida);
    if (chegada && saida) {
      totalMs += Math.max(0, saida.getTime() - chegada.getTime());
    }
  }

  return Math.round((totalMs / (1000 * 60 * 60)) * 100) / 100;
}

/** Formata horas decimais como HH:mm para exportação. */
export function formatHorasDecimalAsHhmm(horas: number): string {
  const totalMinutes = Math.round(horas * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
