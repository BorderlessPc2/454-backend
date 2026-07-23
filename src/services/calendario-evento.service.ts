import { Prisma, PrismaClient } from "@prisma/client";
import {
  assertInclusiveDateRange,
  toFullCalendarExclusiveEnd,
} from "../lib/calendario-evento-dates.js";
import {
  formatDataVisitaWallClock,
  parseDateFilterWallClock,
  parseDataVisita,
} from "../lib/horario-datetime.js";
import type {
  CalendarioEventoFilters,
  CalendarioEventoResponse,
  CreateCalendarioEventoDTO,
  UpdateCalendarioEventoDTO,
} from "../types/calendario-evento.js";

const EVENTO_INCLUDE = {
  cliente: { select: { id: true, nomeFantasia: true } },
  criadoPor: { select: { id: true, nome: true } },
} satisfies Prisma.CalendarioEventoInclude;

type EventoRow = Prisma.CalendarioEventoGetPayload<{
  include: typeof EVENTO_INCLUDE;
}>;

function normalizeTitulo(titulo: string): string {
  const trimmed = titulo.trim();
  if (!trimmed) {
    throw new Error("titulo é obrigatório");
  }
  if (trimmed.length > 200) {
    throw new Error("titulo deve ter no máximo 200 caracteres");
  }
  return trimmed;
}

function parseYmdField(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`${fieldName} deve estar no formato YYYY-MM-DD`);
  }
  // Valida data real
  parseDataVisita(trimmed);
  return trimmed;
}

export function mapCalendarioEventoToResponse(
  row: EventoRow,
): CalendarioEventoResponse {
  const dataInicio = formatDataVisitaWallClock(row.dataInicio);
  const dataFim = formatDataVisitaWallClock(row.dataFim);

  return {
    id: String(row.id),
    title: row.titulo,
    start: dataInicio,
    end: toFullCalendarExclusiveEnd(dataFim),
    allDay: true,
    classNames: ["calendario-evento"],
    extendedProps: {
      dataInicio,
      dataFim,
      descricao: row.descricao ?? null,
      clienteId: row.cliente?.id ?? null,
      clienteNome: row.cliente?.nomeFantasia ?? null,
      criadoPorId: row.criadoPor.id,
      criadoPorNome: row.criadoPor.nome,
    },
  };
}

export class CalendarioEventoService {
  constructor(private prisma: PrismaClient) {}

  private buildOverlapWhere(
    filters: CalendarioEventoFilters,
  ): Prisma.CalendarioEventoWhereInput {
    const rangeInicio = parseDateFilterWallClock(filters.dataInicio);
    const rangeFim = parseDateFilterWallClock(filters.dataFim, true);

    if (rangeInicio > rangeFim) {
      throw new Error("dataInicio não pode ser maior que dataFim");
    }

    // Overlap: evento começa antes/igual ao fim do range E termina depois/igual ao início
    const where: Prisma.CalendarioEventoWhereInput = {
      dataInicio: { lte: rangeFim },
      dataFim: { gte: rangeInicio },
    };

    if (filters.clienteId !== undefined) {
      where.clienteId = filters.clienteId;
    }
    if (filters.criadoPorId !== undefined) {
      where.criadoPorId = filters.criadoPorId;
    }

    return where;
  }

  async list(filters: CalendarioEventoFilters): Promise<CalendarioEventoResponse[]> {
    const rows = await this.prisma.calendarioEvento.findMany({
      where: this.buildOverlapWhere(filters),
      include: EVENTO_INCLUDE,
      orderBy: [{ dataInicio: "asc" }, { id: "asc" }],
    });

    return rows.map(mapCalendarioEventoToResponse);
  }

  async findById(id: number): Promise<CalendarioEventoResponse | null> {
    const row = await this.prisma.calendarioEvento.findUnique({
      where: { id },
      include: EVENTO_INCLUDE,
    });
    return row ? mapCalendarioEventoToResponse(row) : null;
  }

  async create(
    data: CreateCalendarioEventoDTO,
    criadoPorId: number,
  ): Promise<CalendarioEventoResponse> {
    const titulo = normalizeTitulo(data.titulo);
    const dataInicioYmd = parseYmdField(data.dataInicio, "dataInicio");
    const dataFimYmd = parseYmdField(data.dataFim, "dataFim");
    assertInclusiveDateRange(dataInicioYmd, dataFimYmd);

    let clienteId: number | null = null;
    if (data.clienteId !== undefined && data.clienteId !== null) {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id: data.clienteId },
        select: { id: true },
      });
      if (!cliente) {
        throw new Error("Cliente não encontrado");
      }
      clienteId = cliente.id;
    }

    const descricao =
      data.descricao === undefined || data.descricao === null
        ? null
        : String(data.descricao).trim() || null;

    const created = await this.prisma.calendarioEvento.create({
      data: {
        titulo,
        descricao,
        dataInicio: parseDataVisita(dataInicioYmd),
        dataFim: parseDataVisita(dataFimYmd),
        clienteId,
        criadoPorId,
      },
      include: EVENTO_INCLUDE,
    });

    return mapCalendarioEventoToResponse(created);
  }

  async update(
    id: number,
    data: UpdateCalendarioEventoDTO,
    actor: { id: number; role: string },
  ): Promise<CalendarioEventoResponse> {
    const existing = await this.prisma.calendarioEvento.findUnique({
      where: { id },
      select: { id: true, criadoPorId: true, dataInicio: true, dataFim: true },
    });

    if (!existing) {
      throw new Error("Evento não encontrado");
    }

    if (actor.role !== "ADMIN" && existing.criadoPorId !== actor.id) {
      throw new Error("Sem permissão para editar este evento");
    }

    const patch: Prisma.CalendarioEventoUncheckedUpdateInput = {};

    if (data.titulo !== undefined) {
      patch.titulo = normalizeTitulo(data.titulo);
    }

    if (data.descricao !== undefined) {
      patch.descricao =
        data.descricao === null ? null : String(data.descricao).trim() || null;
    }

    const nextInicioYmd =
      data.dataInicio !== undefined
        ? parseYmdField(data.dataInicio, "dataInicio")
        : formatDataVisitaWallClock(existing.dataInicio);
    const nextFimYmd =
      data.dataFim !== undefined
        ? parseYmdField(data.dataFim, "dataFim")
        : formatDataVisitaWallClock(existing.dataFim);

    if (data.dataInicio !== undefined || data.dataFim !== undefined) {
      assertInclusiveDateRange(nextInicioYmd, nextFimYmd);
      patch.dataInicio = parseDataVisita(nextInicioYmd);
      patch.dataFim = parseDataVisita(nextFimYmd);
    }

    if (data.clienteId !== undefined) {
      if (data.clienteId === null) {
        patch.clienteId = null;
      } else {
        const cliente = await this.prisma.cliente.findUnique({
          where: { id: data.clienteId },
          select: { id: true },
        });
        if (!cliente) {
          throw new Error("Cliente não encontrado");
        }
        patch.clienteId = cliente.id;
      }
    }

    const updated = await this.prisma.calendarioEvento.update({
      where: { id },
      data: patch,
      include: EVENTO_INCLUDE,
    });

    return mapCalendarioEventoToResponse(updated);
  }

  async delete(
    id: number,
    actor: { id: number; role: string },
  ): Promise<void> {
    const existing = await this.prisma.calendarioEvento.findUnique({
      where: { id },
      select: { id: true, criadoPorId: true },
    });

    if (!existing) {
      throw new Error("Evento não encontrado");
    }

    if (actor.role !== "ADMIN" && existing.criadoPorId !== actor.id) {
      throw new Error("Sem permissão para excluir este evento");
    }

    await this.prisma.calendarioEvento.delete({ where: { id } });
  }
}
