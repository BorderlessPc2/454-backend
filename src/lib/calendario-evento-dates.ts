import {
  formatDataVisitaWallClock,
  parseDateFilterWallClock,
  parseDataVisita,
} from "./horario-datetime.js";

/** Soma dias a uma data YYYY-MM-DD (calendário UTC wall-clock). */
export function addDaysYmd(dateYmd: string, days: number): string {
  const base = parseDataVisita(dateYmd);
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return formatDataVisitaWallClock(next);
}

/**
 * FullCalendar allDay: `end` é exclusivo.
 * Evento inclusivo 20–22 → start=20, end=23.
 */
export function toFullCalendarExclusiveEnd(dataFimInclusiveYmd: string): string {
  return addDaysYmd(dataFimInclusiveYmd, 1);
}

export function assertInclusiveDateRange(
  dataInicioYmd: string,
  dataFimYmd: string,
): void {
  const inicio = parseDateFilterWallClock(dataInicioYmd);
  const fim = parseDateFilterWallClock(dataFimYmd, true);
  if (inicio > fim) {
    throw new Error("dataInicio não pode ser maior que dataFim");
  }
}
