import { Prisma, PrismaClient } from "@prisma/client";
import {
  formatDateTimeWallClock,
  formatModalidadeShort,
  parseDataVisitaIsoDateTime,
  resolveCalendarEventBounds,
  combineDatePartWithTime,
} from "../lib/calendario-datetime.js";
import {
  formatDataVisitaWallClock,
  parseDateFilterWallClock,
} from "../lib/horario-datetime.js";
import { auditLogger } from "../lib/audit-logger.js";
import { RelatorioForbiddenError } from "./relatorio.service.js";
import type {
  CalendarioEvent,
  CalendarioFilters,
  CreateAgendamentoDTO,
} from "../types/relatorio-calendario.js";

const RELATORIO_CALENDARIO_INCLUDE = {
  cliente: { select: { id: true, nomeFantasia: true, unidadeId: true } },
  tecnicos: { select: { nome: true } },
  horarios: {
    select: { horaChegada: true, horaSaida: true },
    orderBy: { horaChegada: "asc" },
  },
} satisfies Prisma.RelatorioInclude;

type RelatorioCalendarioRow = Prisma.RelatorioGetPayload<{
  include: typeof RELATORIO_CALENDARIO_INCLUDE;
}>;

export class RelatorioCalendarioStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RelatorioCalendarioStatusError";
  }
}

export function mapRelatorioToCalendarioEvent(
  relatorio: RelatorioCalendarioRow,
): CalendarioEvent {
  const { start, end } = resolveCalendarEventBounds(
    relatorio.dataVisita,
    relatorio.horarios,
  );

  return {
    id: String(relatorio.id),
    title: `Visita - ${relatorio.cliente.nomeFantasia}`,
    start: formatDateTimeWallClock(start),
    end: formatDateTimeWallClock(end),
    extendedProps: {
      clienteId: relatorio.cliente.id,
      clienteNome: relatorio.cliente.nomeFantasia,
      status: relatorio.status,
      tecnicos: relatorio.tecnicos.map((t) => t.nome),
      modalidade: formatModalidadeShort(relatorio.modalidadeServico),
      impresso: relatorio.impresso,
      criadoPorId: relatorio.criadoPorId,
    },
  };
}

export class RelatorioCalendarioService {
  constructor(private prisma: PrismaClient) {}

  private buildCalendarioWhere(
    filters: CalendarioFilters,
    tecnicoNomeFilter?: string,
  ): Prisma.RelatorioWhereInput {
    const inicio = parseDateFilterWallClock(filters.dataInicio);
    const fim = parseDateFilterWallClock(filters.dataFim, true);

    if (inicio > fim) {
      throw new Error("dataInicio não pode ser maior que dataFim");
    }

    const where: Prisma.RelatorioWhereInput = {
      dataVisita: { gte: inicio, lte: fim },
    };

    if (filters.scopedUnidadeId !== null) {
      where.cliente = { unidadeId: filters.scopedUnidadeId };
    }

    if (filters.clienteId !== undefined) {
      where.clienteId = filters.clienteId;
    }

    if (tecnicoNomeFilter) {
      where.tecnicos = {
        some: {
          nome: { equals: tecnicoNomeFilter, mode: "insensitive" },
        },
      };
    }

    return where;
  }

  async listCalendarioEvents(filters: CalendarioFilters): Promise<CalendarioEvent[]> {
    let tecnicoNomeFilter: string | undefined;

    if (filters.tecnicoId !== undefined) {
      const tecnico = await this.prisma.user.findUnique({
        where: { id: filters.tecnicoId },
        select: { nome: true },
      });
      if (!tecnico) {
        throw new Error("Técnico não encontrado");
      }
      tecnicoNomeFilter = tecnico.nome;
    }

    const relatorios = await this.prisma.relatorio.findMany({
      where: this.buildCalendarioWhere(filters, tecnicoNomeFilter),
      include: RELATORIO_CALENDARIO_INCLUDE,
      orderBy: { dataVisita: "asc" },
    });

    return relatorios.map(mapRelatorioToCalendarioEvent);
  }

  async reagendarDataVisita(
    id: number,
    dataVisitaIso: string,
    scopedUnidadeId: number | null,
    requesterRole: string | undefined,
    requesterUserId: number,
  ) {
    const parsed = parseDataVisitaIsoDateTime(dataVisitaIso);
    const newStart = combineDatePartWithTime(
      parsed.datePart,
      parsed.hour,
      parsed.minute,
    );

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.relatorio.findFirst({
        where:
          scopedUnidadeId === null
            ? { id }
            : { id, cliente: { unidadeId: scopedUnidadeId } },
        include: { horarios: { orderBy: { horaChegada: "asc" } } },
      });

      if (!existing) {
        throw new Error("Relatório não encontrado");
      }

      if (existing.status === "FINALIZADO" || existing.status === "CANCELADO") {
        throw new RelatorioCalendarioStatusError(
          "Não é permitido reagendar relatórios finalizados ou cancelados",
        );
      }

      const isAdmin = requesterRole === "ADMIN";
      const isCreator = existing.criadoPorId === requesterUserId;
      if (!isAdmin && !isCreator) {
        throw new RelatorioForbiddenError(
          "Somente ADMIN ou o criador do relatório pode reagendar a visita",
        );
      }

      const oldDatePart = formatDataVisitaWallClock(existing.dataVisita);
      const { start: oldStart } = resolveCalendarEventBounds(
        existing.dataVisita,
        existing.horarios,
      );
      const deltaMs = newStart.getTime() - oldStart.getTime();

      await tx.relatorio.update({
        where: { id },
        data: { dataVisita: parsed.dataVisita },
      });

      if (existing.horarios.length > 0) {
        for (const horario of existing.horarios) {
          await tx.relatorioHorario.update({
            where: { id: horario.id },
            data: {
              horaChegada: new Date(horario.horaChegada.getTime() + deltaMs),
              horaSaida: new Date(horario.horaSaida.getTime() + deltaMs),
            },
          });
        }
      } else {
        await tx.relatorioHorario.create({
          data: {
            relatorioId: id,
            horaChegada: newStart,
            horaSaida: new Date(newStart.getTime() + 60 * 60 * 1000),
          },
        });
      }

      await auditLogger(tx, {
        relatorioId: id,
        usuarioId: requesterUserId,
        acao: "UPDATE",
      });

      const updated = await tx.relatorio.findUnique({
        where: { id },
        include: {
          cliente: true,
          contato: true,
          criadoPor: {
            select: { id: true, nome: true, username: true },
          },
          tecnicos: true,
          setores: { include: { setor: true } },
          horarios: true,
          checklists: { include: { checklist: true } },
        },
      });

      if (!updated) {
        throw new Error("Falha ao carregar relatório após reagendamento");
      }

      return {
        relatorio: updated,
        evento: mapRelatorioToCalendarioEvent(updated),
        dataVisitaAnterior: oldDatePart,
      };
    });
  }

  async createAgendamento(
    data: CreateAgendamentoDTO,
    criadoPorId: number,
    scopedUnidadeId: number | null,
  ) {
    const parsed = parseDataVisitaIsoDateTime(data.dataVisita);

    if (!Array.isArray(data.tecnicos) || data.tecnicos.length === 0) {
      throw new Error("tecnicos é obrigatório e deve conter ao menos um nome");
    }

    const tecnicos = data.tecnicos
      .map((nome) => nome.trim())
      .filter((nome) => nome.length > 0);

    if (tecnicos.length === 0) {
      throw new Error("tecnicos deve conter ao menos um nome válido");
    }

    if (data.status !== undefined && data.status !== "AGENDADO") {
      throw new Error("status deve ser AGENDADO");
    }

    return this.prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findFirst({
        where:
          scopedUnidadeId === null
            ? { id: data.clienteId }
            : { id: data.clienteId, unidadeId: scopedUnidadeId },
        select: { id: true },
      });

      if (!cliente) {
        throw new Error("Cliente não pertence à sua unidade");
      }

      const relatorio = await tx.relatorio.create({
        data: {
          clienteId: data.clienteId,
          criadoPorId,
          dataVisita: parsed.dataVisita,
          status: "AGENDADO",
        },
      });

      await tx.relatorioTecnico.createMany({
        data: tecnicos.map((nome) => ({
          relatorioId: relatorio.id,
          nome,
        })),
      });

      const start = combineDatePartWithTime(
        parsed.datePart,
        parsed.hour,
        parsed.minute,
      );
      await tx.relatorioHorario.create({
        data: {
          relatorioId: relatorio.id,
          horaChegada: start,
          horaSaida: new Date(start.getTime() + 60 * 60 * 1000),
        },
      });

      await auditLogger(tx, {
        relatorioId: relatorio.id,
        usuarioId: criadoPorId,
        acao: "CREATE",
      });

      const completo = await tx.relatorio.findUnique({
        where: { id: relatorio.id },
        include: {
          cliente: true,
          contato: true,
          criadoPor: {
            select: { id: true, nome: true, username: true },
          },
          tecnicos: true,
          setores: { include: { setor: true } },
          horarios: true,
          checklists: { include: { checklist: true } },
        },
      });

      if (!completo) {
        throw new Error("Falha ao carregar agendamento após criação");
      }

      return completo;
    });
  }
}
