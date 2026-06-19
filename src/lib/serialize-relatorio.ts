import type { RelatorioHorario } from "@prisma/client";
import {
  formatDataVisitaWallClock,
  formatHorarioWallClock,
} from "./horario-datetime.js";

export type RelatorioHorarioResponse = Omit<
  RelatorioHorario,
  "horaChegada" | "horaSaida"
> & {
  /** ISO 8601 (UTC) — compatível com clientes que fazem `new Date(...)`. */
  horaChegada: string;
  horaSaida: string;
  /** Horário de parede `HH:mm` — use direto em `<input type="time">`. */
  horaChegadaHhmm: string;
  horaSaidaHhmm: string;
};

type RelatorioComHorarios = {
  dataVisita: Date;
  horarios?: RelatorioHorario[];
};

export function serializeRelatorioHorario(
  horario: RelatorioHorario,
): RelatorioHorarioResponse {
  return {
    ...horario,
    horaChegada: horario.horaChegada.toISOString(),
    horaSaida: horario.horaSaida.toISOString(),
    horaChegadaHhmm: formatHorarioWallClock(horario.horaChegada),
    horaSaidaHhmm: formatHorarioWallClock(horario.horaSaida),
  };
}

export function serializeRelatorio<T extends RelatorioComHorarios>(
  relatorio: T,
): Record<string, unknown> {
  const { horarios, dataVisita, ...rest } = relatorio;
  const dataVisitaIso = parseDataVisitaFromDate(dataVisita).toISOString();

  return {
    ...rest,
    dataVisita: dataVisitaIso,
    dataVisitaHhmm: formatDataVisitaWallClock(dataVisita),
    ...(horarios !== undefined
      ? { horarios: horarios.map(serializeRelatorioHorario) }
      : {}),
  };
}

function parseDataVisitaFromDate(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
    ),
  );
}

export function serializeRelatorios<T extends RelatorioComHorarios>(
  relatorios: T[],
): Record<string, unknown>[] {
  return relatorios.map(serializeRelatorio);
}
