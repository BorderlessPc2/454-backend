import {
  combineDataHoraWallClock,
  extractDatePart,
  formatDataVisitaWallClock,
  formatHorarioWallClock,
  parseDataVisita,
} from "./horario-datetime.js";

export type ParsedDataVisitaDateTime = {
  datePart: string;
  dataVisita: Date;
  hour: number;
  minute: number;
};

/** Interpreta ISO / YYYY-MM-DD como horário de parede (componentes UTC). */
export function parseDataVisitaIsoDateTime(value: string): ParsedDataVisitaDateTime {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("dataVisita inválida");
  }

  const datePart = extractDatePart(
    trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00`,
  );
  const dataVisita = parseDataVisita(datePart);

  let hour = 8;
  let minute = 0;

  if (trimmed.includes("T")) {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("dataVisita inválida");
    }
    hour = parsed.getUTCHours();
    minute = parsed.getUTCMinutes();
  }

  return { datePart, dataVisita, hour, minute };
}

export function formatDateTimeWallClock(date: Date): string {
  return `${formatDataVisitaWallClock(date)}T${formatHorarioWallClock(date)}:00`;
}

export function combineDatePartWithTime(
  datePart: string,
  hour: number,
  minute: number,
): Date {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return combineDataHoraWallClock(datePart, `${hh}:${mm}`);
}

type HorarioSlot = {
  horaChegada: Date;
  horaSaida: Date;
};

export function resolveCalendarEventBounds(
  dataVisita: Date,
  horarios: HorarioSlot[],
): { start: Date; end: Date } {
  const datePart = formatDataVisitaWallClock(dataVisita);

  if (horarios.length === 0) {
    const start = combineDataHoraWallClock(datePart, "08:00");
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return { start, end };
  }

  const sorted = [...horarios].sort(
    (a, b) => a.horaChegada.getTime() - b.horaChegada.getTime(),
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (!first || !last) {
    const start = combineDataHoraWallClock(datePart, "08:00");
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return { start, end };
  }

  const start = first.horaChegada;
  const end =
    last.horaSaida.getTime() > start.getTime()
      ? last.horaSaida
      : new Date(start.getTime() + 60 * 60 * 1000);

  return { start, end };
}

export function formatModalidadeShort(modalidade: string | null | undefined): string {
  if (!modalidade) {
    return "N/A";
  }
  const lower = modalidade.toLowerCase();
  if (lower.includes("local")) {
    return "Local";
  }
  if (lower.includes("remoto")) {
    return "Remoto";
  }
  return modalidade;
}
