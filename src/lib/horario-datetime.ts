/**
 * Horários de relatório são "horário de parede" (ex.: 08:00 digitado = 08:00 exibido),
 * sem conversão de fuso. Os valores são ancorados em UTC no banco para consistência
 * entre servidor (Render), PDF e formulário de edição no browser.
 */
export function extractDatePart(value: string): string {
  const part = value.split("T")[0]?.trim();
  if (!part || !/^\d{4}-\d{2}-\d{2}$/.test(part)) {
    throw new Error("Data inválida");
  }
  return part;
}

function parseYmd(datePart: string): { year: number; month: number; day: number } {
  const [year, month, day] = extractDatePart(datePart).split("-").map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    throw new Error("Data inválida");
  }
  return { year, month, day };
}

export function combineDataHoraWallClock(datePart: string, hora: string): Date {
  const { year, month, day } = parseYmd(datePart);
  const [hour, minute] = hora.trim().split(":").map(Number);

  if (
    hour === undefined ||
    minute === undefined ||
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error("Horario invalido (HH:mm)");
  }

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  if (Number.isNaN(date.getTime())) {
    throw new Error("Horario invalido (HH:mm)");
  }
  return date;
}

export function formatHorarioWallClock(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

export function parseDataVisita(value: string): Date {
  const { year, month, day } = parseYmd(value);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  if (Number.isNaN(date.getTime())) {
    throw new Error("Data da visita inválida");
  }
  return date;
}

export function formatDataVisitaWallClock(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateFilterWallClock(
  dateValue: string,
  endOfDay = false,
): Date {
  const { year, month, day } = parseYmd(dateValue);
  if (endOfDay) {
    return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  }
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

/**
 * Aceita "HH:mm" ou ISO 8601. Combina com a data da visita sem alterar o horário digitado.
 */
export function parseHorario(dataVisita: string, horario: string): Date {
  const trimmed = horario.trim();
  if (!trimmed) {
    throw new Error("Horario invalido (HH:mm)");
  }

  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const hhmm = trimmed.slice(0, 5);
    return combineDataHoraWallClock(dataVisita, hhmm);
  }

  if (trimmed.includes("T")) {
    const dateTime = new Date(trimmed);
    if (Number.isNaN(dateTime.getTime())) {
      throw new Error("Horario invalido (ISO 8601)");
    }
    return combineDataHoraWallClock(
      dataVisita,
      formatHorarioWallClock(dateTime),
    );
  }

  throw new Error("Horario invalido (HH:mm)");
}

export function formatDateWallClock(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function getPeriodoWallClock(date: Date): string {
  const hour = date.getUTCHours();
  if (hour < 12) return "Manhã";
  if (hour < 18) return "Tarde";
  return "Noite";
}
