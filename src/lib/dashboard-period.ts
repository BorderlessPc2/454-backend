import {
  extractDatePart,
  formatDataVisitaWallClock,
  parseDateFilterWallClock,
} from "./horario-datetime.js";

export type DashboardPeriod = {
  dataInicio: string;
  dataFim: string;
  inicio: Date;
  fim: Date;
};

function todayWallClockParts(): { year: number; month: number; day: number } {
  const now = new Date();
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
  };
}

function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Período padrão: dia 1 do mês corrente até hoje (wall clock UTC). */
export function getDefaultDashboardPeriod(): DashboardPeriod {
  const { year, month, day } = todayWallClockParts();
  const dataInicio = formatYmd(year, month, 1);
  const dataFim = formatYmd(year, month, day);

  return {
    dataInicio,
    dataFim,
    inicio: parseDateFilterWallClock(dataInicio),
    fim: parseDateFilterWallClock(dataFim, true),
  };
}

/** Primeiro mês do período (para SLA esperado de contratos). */
export function getFirstMonthRangeFromPeriod(inicio: Date): {
  inicio: Date;
  fim: Date;
} {
  const year = inicio.getUTCFullYear();
  const month = inicio.getUTCMonth();
  return {
    inicio: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
    fim: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
  };
}

/** Mês corrente completo até o fim do dia de hoje. */
export function getCurrentMonthRangeToToday(): { inicio: Date; fim: Date } {
  const { year, month, day } = todayWallClockParts();
  const dataInicio = formatYmd(year, month, 1);
  const dataFim = formatYmd(year, month, day);
  return {
    inicio: parseDateFilterWallClock(dataInicio),
    fim: parseDateFilterWallClock(dataFim, true),
  };
}

export function parseDashboardPeriod(
  dataInicioRaw?: string,
  dataFimRaw?: string,
): DashboardPeriod {
  if (
    (dataInicioRaw === undefined || dataInicioRaw.trim() === "") &&
    (dataFimRaw === undefined || dataFimRaw.trim() === "")
  ) {
    return getDefaultDashboardPeriod();
  }

  if (
    dataInicioRaw === undefined ||
    dataInicioRaw.trim() === "" ||
    dataFimRaw === undefined ||
    dataFimRaw.trim() === ""
  ) {
    throw new Error(
      "dataInicio e dataFim devem ser informados juntos (formato YYYY-MM-DD)",
    );
  }

  const dataInicio = extractDatePart(dataInicioRaw.trim());
  const dataFim = extractDatePart(dataFimRaw.trim());
  const inicio = parseDateFilterWallClock(dataInicio);
  const fim = parseDateFilterWallClock(dataFim, true);

  if (inicio > fim) {
    throw new Error("dataInicio não pode ser maior que dataFim");
  }

  return { dataInicio, dataFim, inicio, fim };
}

export function formatHorasKpiString(horas: number): string {
  return (Math.round(horas * 100) / 100).toFixed(2);
}

export function computePercentualConcluido(
  realizadas: number,
  esperadas: number,
): number {
  if (esperadas <= 0) {
    return 0;
  }
  return Math.round((realizadas / esperadas) * 10000) / 100;
}
