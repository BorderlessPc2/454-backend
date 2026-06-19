type HorarioInputRecord = Record<string, unknown>;

export type HorarioInputNormalized = {
  horaChegada: string;
  horaSaida: string;
};

function readHorarioField(
  item: HorarioInputRecord,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return null;
}

export function normalizeHorarioItem(
  item: HorarioInputRecord,
): HorarioInputNormalized | null {
  const horaChegada = readHorarioField(item, [
    "horaChegada",
    "horaInicial",
    "horaInicio",
    "hora_inicial",
    "hora_chegada",
  ]);
  const horaSaida = readHorarioField(item, [
    "horaSaida",
    "horaFinal",
    "horaFim",
    "hora_final",
    "hora_saida",
  ]);

  if (!horaChegada || !horaSaida) {
    return null;
  }

  return { horaChegada, horaSaida };
}

/** Aceita array ou objeto único (legado) e ignora linhas vazias. */
export function normalizeHorariosInput(
  horarios: unknown,
): HorarioInputNormalized[] {
  if (horarios == null) {
    return [];
  }

  const items = Array.isArray(horarios) ? horarios : [horarios];

  return items
    .filter((item): item is HorarioInputRecord => typeof item === "object" && item !== null)
    .map(normalizeHorarioItem)
    .filter((item): item is HorarioInputNormalized => item !== null);
}
