const PERIODO_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export type PeriodoRange = {
  periodo: string;
  inicio: Date;
  fim: Date;
};

export function parsePeriodoYYYYMM(periodo: string): PeriodoRange {
  const trimmed = periodo.trim();
  if (!PERIODO_REGEX.test(trimmed)) {
    throw new Error("periodo inválido: use o formato YYYY-MM (ex.: 2025-01)");
  }

  const [yearStr, monthStr] = trimmed.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  const inicio = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const fim = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  return { periodo: trimmed, inicio, fim };
}
