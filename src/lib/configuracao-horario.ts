import {
  combineDataHoraWallClock,
  formatHorarioWallClock,
} from "./horario-datetime.js";

/** Data âncora para horário de login — só importam hora e minuto (wall clock UTC). */
export const CONFIG_HORARIO_ANCHOR_DATE = "1970-01-01";

const HHMM_REGEX = /^\d{1,2}:\d{2}(:\d{2})?$/;
const ISO_TIME_PART_REGEX = /T(\d{1,2}):(\d{2})/;

/** Extrai HH:mm literal do texto ISO (sem conversão de fuso). */
export function extractHhmmFromIsoLike(value: string): string | null {
  const match = ISO_TIME_PART_REGEX.exec(value.trim());
  if (!match?.[1] || !match[2]) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseConfigHorarioInput(value: unknown): Date {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Horário inválido (use HH:mm ou ISO 8601)");
  }

  const trimmed = value.trim();

  if (HHMM_REGEX.test(trimmed)) {
    return combineDataHoraWallClock(
      CONFIG_HORARIO_ANCHOR_DATE,
      trimmed.slice(0, 5),
    );
  }

  const hhmmFromIso = extractHhmmFromIsoLike(trimmed);
  if (hhmmFromIso) {
    return combineDataHoraWallClock(CONFIG_HORARIO_ANCHOR_DATE, hhmmFromIso);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Horário inválido (use HH:mm ou ISO 8601)");
  }

  return combineDataHoraWallClock(
    CONFIG_HORARIO_ANCHOR_DATE,
    formatHorarioWallClock(parsed),
  );
}

/** Normaliza registros legados (ex.: seed com datas 2020/2030) para âncora 1970. */
export function normalizeStoredConfigHorario(
  dataInicio: Date,
  dataFim: Date,
): { dataInicio: Date; dataFim: Date } {
  return {
    dataInicio: combineDataHoraWallClock(
      CONFIG_HORARIO_ANCHOR_DATE,
      formatHorarioWallClock(dataInicio),
    ),
    dataFim: combineDataHoraWallClock(
      CONFIG_HORARIO_ANCHOR_DATE,
      formatHorarioWallClock(dataFim),
    ),
  };
}

export function normalizeConfigHorarioPair(
  dataInicio: Date,
  dataFim: Date,
): { dataInicio: Date; dataFim: Date } {
  const inicio = parseConfigHorarioInput(dataInicio.toISOString());
  const fim = parseConfigHorarioInput(dataFim.toISOString());

  if (fim < inicio) {
    throw new Error("Hora fim deve ser posterior ou igual à hora início");
  }

  return { dataInicio: inicio, dataFim: fim };
}

export function defaultConfigHorario(): { dataInicio: Date; dataFim: Date } {
  return {
    dataInicio: parseConfigHorarioInput("08:00"),
    dataFim: parseConfigHorarioInput("18:00"),
  };
}

export type ConfigHorarioSerialized = {
  horaInicio: string;
  horaFim: string;
  dataInicio: string;
  dataFim: string;
};

export function serializeConfigHorario(
  dataInicio: Date,
  dataFim: Date,
): ConfigHorarioSerialized {
  const horaInicio = formatHorarioWallClock(dataInicio);
  const horaFim = formatHorarioWallClock(dataFim);

  // horaInicio/horaFim: uso direto em <input type="time">.
  // dataInicio/dataFim: ISO âncora 1970 — compatível com front legado que faz .slice(11, 16).
  return {
    horaInicio,
    horaFim,
    dataInicio: combineDataHoraWallClock(
      CONFIG_HORARIO_ANCHOR_DATE,
      horaInicio,
    ).toISOString(),
    dataFim: combineDataHoraWallClock(
      CONFIG_HORARIO_ANCHOR_DATE,
      horaFim,
    ).toISOString(),
  };
}

export function readHorarioFieldsFromBody(body: Record<string, unknown>): {
  inicio?: unknown;
  fim?: unknown;
} {
  return {
    inicio:
      body["horaInicio"] ??
      body["hora_inicio"] ??
      body["dataInicio"] ??
      body["data_inicio"],
    fim:
      body["horaFim"] ??
      body["hora_fim"] ??
      body["dataFim"] ??
      body["data_fim"],
  };
}
