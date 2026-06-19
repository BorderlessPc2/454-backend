import type { RelatorioHorario } from "@prisma/client";
import {
  formatDataVisitaWallClock,
  formatHorarioWallClock,
} from "./horario-datetime.js";

export type RelatorioHorarioResponse = Omit<
  RelatorioHorario,
  "horaChegada" | "horaSaida"
> & {
  horaChegada: string;
  horaSaida: string;
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
    horaChegada: formatHorarioWallClock(horario.horaChegada),
    horaSaida: formatHorarioWallClock(horario.horaSaida),
  };
}

export function serializeRelatorio<T extends RelatorioComHorarios>(
  relatorio: T,
): Record<string, unknown> {
  const { horarios, dataVisita, ...rest } = relatorio;

  return {
    ...rest,
    dataVisita: formatDataVisitaWallClock(dataVisita),
    ...(horarios !== undefined
      ? { horarios: horarios.map(serializeRelatorioHorario) }
      : {}),
  };
}

export function serializeRelatorios<T extends RelatorioComHorarios>(
  relatorios: T[],
): Record<string, unknown>[] {
  return relatorios.map(serializeRelatorio);
}
