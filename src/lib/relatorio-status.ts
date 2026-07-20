import type { RelatorioStatus } from "@prisma/client";

export const RELATORIO_STATUS_VALUES = [
  "AGENDADO",
  "FINALIZADO",
  "CANCELADO",
] as const satisfies readonly RelatorioStatus[];

/** Transições permitidas no workflow operacional. */
const TRANSICOES_PERMITIDAS: Readonly<
  Record<RelatorioStatus, readonly RelatorioStatus[]>
> = {
  AGENDADO: ["FINALIZADO", "CANCELADO"],
  FINALIZADO: ["CANCELADO", "AGENDADO"],
  CANCELADO: ["AGENDADO"],
};

export class RelatorioStatusTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RelatorioStatusTransitionError";
  }
}

export function isRelatorioStatus(value: unknown): value is RelatorioStatus {
  return (
    typeof value === "string" &&
    (RELATORIO_STATUS_VALUES as readonly string[]).includes(value)
  );
}

export function parseRelatorioStatus(value: unknown): RelatorioStatus {
  if (!isRelatorioStatus(value)) {
    throw new RelatorioStatusTransitionError(
      `status inválido (use ${RELATORIO_STATUS_VALUES.join(", ")})`,
    );
  }
  return value;
}

export function assertTransicaoStatusPermitida(
  atual: RelatorioStatus,
  proximo: RelatorioStatus,
): void {
  if (atual === proximo) {
    throw new RelatorioStatusTransitionError(
      `Relatório já está com status ${atual}`,
    );
  }

  const permitidos = TRANSICOES_PERMITIDAS[atual];
  if (!permitidos.includes(proximo)) {
    throw new RelatorioStatusTransitionError(
      `Transição de ${atual} para ${proximo} não é permitida. ` +
        `Permitidas a partir de ${atual}: ${permitidos.join(", ") || "(nenhuma)"}`,
    );
  }
}

/**
 * Aceita `status=AGENDADO`, `status=AGENDADO,FINALIZADO` ou
 * múltiplos `status=AGENDADO&status=FINALIZADO`.
 */
export function parseStatusFilter(
  raw: unknown,
): RelatorioStatus[] | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }

  const parts: string[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string") {
        parts.push(...item.split(","));
      }
    }
  } else if (typeof raw === "string") {
    parts.push(...raw.split(","));
  } else {
    throw new RelatorioStatusTransitionError("Filtro status inválido");
  }

  const statuses = parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => parseRelatorioStatus(part));

  if (statuses.length === 0) {
    return undefined;
  }

  return [...new Set(statuses)];
}

export function getTransicoesPermitidas(
  atual: RelatorioStatus,
): readonly RelatorioStatus[] {
  return TRANSICOES_PERMITIDAS[atual];
}
