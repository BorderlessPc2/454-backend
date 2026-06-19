import {
  formatHorarioWallClock,
  getPeriodoWallClock,
} from "./horario-datetime.js";

export type HorarioTableRow = {
  periodo: string;
  intervalo: string;
  duracao: string;
};

type HorarioInput = {
  horaChegada: Date | string;
  horaSaida: Date | string;
};

function parseDate(value: Date | string): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTime(d: Date): string {
  return formatHorarioWallClock(d);
}

function getPeriodo(hora: Date): string {
  return getPeriodoWallClock(hora);
}

function formatDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return "00:00";
  const totalMinutes = Math.round(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

const ORDEM_PERIODOS = ["Manhã", "Tarde", "Noite", "N/A"] as const;

export function buildHorarioTableRows(
  horarios: HorarioInput[],
): HorarioTableRow[] {
  const sorted = [...horarios].sort((a, b) => {
    const da = parseDate(a.horaChegada)?.getTime() ?? 0;
    const db = parseDate(b.horaChegada)?.getTime() ?? 0;
    return da - db;
  });

  const grupos: Record<string, { chegada: Date | null; saida: Date | null }[]> =
    {};

  for (const h of sorted) {
    const chegada = parseDate(h.horaChegada);
    const saida = parseDate(h.horaSaida);
    const key = chegada ? getPeriodo(chegada) : "N/A";
    grupos[key] = grupos[key] ?? [];
    grupos[key].push({ chegada, saida });
  }

  const rows: HorarioTableRow[] = [];

  for (const periodo of ORDEM_PERIODOS) {
    const items = grupos[periodo];
    if (!items || items.length === 0) continue;

    const intervalos: string[] = [];
    const duracoes: string[] = [];

    for (const item of items) {
      const { chegada, saida } = item;
      intervalos.push(
        chegada && saida
          ? `${formatTime(chegada)} - ${formatTime(saida)}`
          : "N/A",
      );
      duracoes.push(
        chegada && saida ? `(${formatDuration(chegada, saida)})` : "(N/A)",
      );
    }

    rows.push({
      periodo,
      intervalo: intervalos.join(" | "),
      duracao: duracoes.join(" | "),
    });
  }

  return rows;
}

export function calcularTotalHoras(horarios: HorarioInput[]): string {
  let totalMs = 0;

  for (const h of horarios) {
    const chegada = parseDate(h.horaChegada);
    const saida = parseDate(h.horaSaida);
    if (chegada && saida) {
      totalMs += Math.max(0, saida.getTime() - chegada.getTime());
    }
  }

  return totalMs > 0
    ? formatDuration(new Date(0), new Date(totalMs))
    : "00:00";
}
