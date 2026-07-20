import { PrismaClient, Prisma, type RelatorioStatus } from "@prisma/client";
import type {
  CreateRelatorioDTO,
  UpdateRelatorioDTO,
  RelatorioFilters,
} from "../types/dtos.js";
import { sanitizeRichTextHtml } from "../lib/sanitize-rich-text.js";
import { auditLogger } from "../lib/audit-logger.js";
import {
  formatDataVisitaWallClock,
  parseDataVisita,
  parseDateFilterWallClock,
  parseHorario,
} from "../lib/horario-datetime.js";
import { normalizeHorariosInput } from "../lib/normalize-horario-input.js";
import {
  assertTransicaoStatusPermitida,
  getTransicoesPermitidas,
  parseRelatorioStatus,
  RelatorioStatusTransitionError,
} from "../lib/relatorio-status.js";

export { RelatorioStatusTransitionError };

const MODALIDADES_SERVICO = ["local", "remoto"] as const;
type ModalidadeServico = (typeof MODALIDADES_SERVICO)[number];

type CreateRelatorioInput = CreateRelatorioDTO & { modalidade?: string };
type UpdateRelatorioInput = UpdateRelatorioDTO & { modalidade?: string };

/** Aceita valores canônicos e labels legados ("Contrato - local", etc.). */
function normalizarModalidadeServico(
  modalidade: string,
): ModalidadeServico | null {
  const trimmed = modalidade.trim().toLowerCase();

  if (
    trimmed === "local" ||
    trimmed.endsWith("- local") ||
    (trimmed.includes("local") && !trimmed.includes("remoto"))
  ) {
    return "local";
  }

  if (
    trimmed === "remoto" ||
    trimmed.endsWith("- remoto") ||
    trimmed.includes("remoto")
  ) {
    return "remoto";
  }

  return null;
}

function validarModalidadeServico(modalidade?: string): ModalidadeServico | undefined {
  if (!modalidade) {
    return undefined;
  }

  const normalizada = normalizarModalidadeServico(modalidade);
  if (!normalizada) {
    throw new Error("Modalidade de servico invalida (use local ou remoto)");
  }

  return normalizada;
}

function resolverModalidadeServico(data: {
  modalidadeServico?: string;
  modalidade?: string;
}): ModalidadeServico | undefined {
  if (
    data.modalidade !== undefined &&
    data.modalidadeServico !== undefined &&
    data.modalidade !== data.modalidadeServico
  ) {
    throw new Error("Campos modalidade e modalidadeServico divergentes");
  }

  const modalidade = data.modalidade ?? data.modalidadeServico;
  return validarModalidadeServico(modalidade);
}

const RELATORIO_INCLUDE_COMPLETO = {
  cliente: true,
  contato: true,
  criadoPor: {
    select: {
      id: true,
      nome: true,
      username: true,
    },
  },
  tecnicos: true,
  setores: {
    include: {
      setor: true,
    },
  },
  horarios: true,
  checklists: {
    include: {
      checklist: true,
    },
  },
} satisfies Prisma.RelatorioInclude;

export class RelatorioForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RelatorioForbiddenError";
  }
}

export class RelatorioService {
  constructor(private prisma: PrismaClient) {}

  private ensureTecnicoPodeAlterarOuExcluir(
    requesterRole: string | undefined,
    requesterUserId: number,
    criadoPorId: number,
    acao: "atualizar" | "excluir",
  ): void {
    if (requesterRole === "TECNICO" && criadoPorId !== requesterUserId) {
      throw new RelatorioForbiddenError(
        acao === "atualizar"
          ? "Somente quem criou o relatório pode editá-lo"
          : "Somente quem criou o relatório pode excluí-lo",
      );
    }
  }

  async create(
    data: CreateRelatorioInput,
    criadoPorId: number,
    scopedUnidadeId: number | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const modalidadeServico = resolverModalidadeServico(data);
      if (!modalidadeServico) {
        throw new Error("Campo modalidade é obrigatório");
      }
      const dataVisita = parseDataVisita(data.dataVisita);

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

      if (data.status !== undefined && data.status !== "FINALIZADO") {
        throw new RelatorioStatusTransitionError(
          "POST /relatorios cria visita finalizada (status FINALIZADO). " +
            "Para agendar, use POST /relatorios/agendamento",
        );
      }

      const relatorioData: Prisma.RelatorioUncheckedCreateInput = {
        clienteId: data.clienteId,
        criadoPorId,
        dataVisita,
        modalidadeServico,
        status: "FINALIZADO",
      };

      if (data.contatoId !== undefined) {
        relatorioData.contatoId = data.contatoId;
      }

      if (data.observacoes !== undefined) {
        relatorioData.observacoes = sanitizeRichTextHtml(data.observacoes);
      }

      const relatorio = await tx.relatorio.create({
        data: relatorioData,
      });

      await auditLogger(tx, {
        relatorioId: relatorio.id,
        usuarioId: criadoPorId,
        acao: "CREATE",
      });

      // técnicos
      if (data.tecnicos && data.tecnicos.length > 0) {
        await tx.relatorioTecnico.createMany({
          data: data.tecnicos.map(
            (nome): Prisma.RelatorioTecnicoCreateManyInput => ({
              relatorioId: relatorio.id,
              nome,
            }),
          ),
        });
      }

      // setores
      if (data.setores && data.setores.length > 0) {
        const setoresCriados = await tx.relatorioSetor.createMany({
          data: data.setores.map(
            (setor): Prisma.RelatorioSetorCreateManyInput => {
              const setorData: Prisma.RelatorioSetorCreateManyInput = {
                relatorioId: relatorio.id,
                setorId: setor.setorId,
              };

              if (setor.observacao !== undefined) {
                setorData.observacao = setor.observacao;
              }

              return setorData;
            },
          ),
        });
        if (setoresCriados.count !== data.setores.length) {
          throw new Error("Falha ao salvar todos os vínculos de setores");
        }
      }

      // horários
      const horariosNormalizados = normalizeHorariosInput(data.horarios);
      if (horariosNormalizados.length > 0) {
        const horariosCriados = await tx.relatorioHorario.createMany({
          data: horariosNormalizados.map(
            (horario): Prisma.RelatorioHorarioCreateManyInput => ({
              relatorioId: relatorio.id,
              horaChegada: parseHorario(data.dataVisita, horario.horaChegada),
              horaSaida: parseHorario(data.dataVisita, horario.horaSaida),
            }),
          ),
        });
        if (horariosCriados.count !== horariosNormalizados.length) {
          throw new Error("Falha ao salvar todos os vínculos de horários");
        }
      }

      // checklists
      if (data.checklists && data.checklists.length > 0) {
        const checklistsCriados = await tx.relatorioChecklist.createMany({
          data: data.checklists.map(
            (check): Prisma.RelatorioChecklistCreateManyInput => ({
              relatorioId: relatorio.id,
              checklistId: check.checklistId,
            }),
          ),
        });
        if (checklistsCriados.count !== data.checklists.length) {
          throw new Error("Falha ao salvar todos os vínculos de checklists");
        }
      }

      const relatorioCompleto = await tx.relatorio.findUnique({
        where: { id: relatorio.id },
        include: {
          cliente: true,
          contato: true,
          criadoPor: {
            select: {
              id: true,
              nome: true,
              username: true,
            },
          },
          tecnicos: true,
          setores: {
            include: {
              setor: true,
            },
          },
          horarios: true,
          checklists: {
            include: {
              checklist: true,
            },
          },
        },
      });
      if (!relatorioCompleto) {
        throw new Error("Falha ao carregar relatório após criação");
      }
      return relatorioCompleto;
    });
  }

  /**
   * Lista relatórios da unidade (escopo). Para `TECNICO`, o filtro `criadoPorId` da query
   * é ignorado — vê todos da unidade; edição/exclusão ficam restritas ao autor.
   */
  async findAll(
    filters: RelatorioFilters | undefined,
    scopedUnidadeId: number | null,
    viewerRole?: string,
  ) {
    const where: Prisma.RelatorioWhereInput = {};
    if (scopedUnidadeId !== null) {
      where.cliente = { unidadeId: scopedUnidadeId };
    }

    if (filters?.clienteId !== undefined) {
      where.clienteId = filters.clienteId;
    }

    if (
      filters?.criadoPorId !== undefined &&
      viewerRole !== "TECNICO"
    ) {
      where.criadoPorId = filters.criadoPorId;
    }

    if (filters?.impresso !== undefined) {
      where.impresso = filters.impresso;
    }

    if (filters?.status !== undefined && filters.status.length > 0) {
      const statuses = filters.status;
      const onlyStatus = statuses.length === 1 ? statuses[0] : undefined;
      if (onlyStatus !== undefined) {
        where.status = onlyStatus;
      } else {
        where.status = { in: statuses };
      }
    }

    if (filters?.dataInicio || filters?.dataFim) {
      where.dataVisita = {};

      if (filters.dataInicio) {
        where.dataVisita.gte = parseDateFilterWallClock(filters.dataInicio);
      }

      if (filters.dataFim) {
        where.dataVisita.lte = parseDateFilterWallClock(filters.dataFim, true);
      }

      if (
        where.dataVisita.gte !== undefined &&
        where.dataVisita.lte !== undefined &&
        where.dataVisita.gte > where.dataVisita.lte
      ) {
        throw new Error("Filtro inválido: dataInicio não pode ser maior que dataFim");
      }
    }

    return this.prisma.relatorio.findMany({
      where,
      include: {
        cliente: true,
        contato: true,
        criadoPor: {
          select: {
            id: true,
            nome: true,
            username: true,
          },
        },
        tecnicos: true,
        setores: {
          include: {
            setor: true,
          },
        },
        horarios: true,
      },
      orderBy: {
        dataVisita: "desc",
      },
    });
  }

  async findById(id: number, scopedUnidadeId: number | null) {
    return this.prisma.relatorio.findFirst({
      where:
        scopedUnidadeId === null
          ? { id }
          : { id, cliente: { unidadeId: scopedUnidadeId } },
      include: {
        cliente: true,
        contato: true,
        criadoPor: {
          select: {
            id: true,
            nome: true,
            username: true,
          },
        },
        tecnicos: true,
        setores: {
          include: {
            setor: true,
          },
        },
        horarios: true,
        checklists: {
          include: {
            checklist: true,
          },
        },
      },
    });
  }

  async getRelatorioParaPdf(id: number, scopedUnidadeId: number | null) {
    const relatorio = await this.prisma.relatorio.findFirst({
      where:
        scopedUnidadeId === null
          ? { id }
          : { id, cliente: { unidadeId: scopedUnidadeId } },
      include: RELATORIO_INCLUDE_COMPLETO,
    });

    if (!relatorio) {
      throw new Error("Relatório não encontrado");
    }

    const contratoAtivo = await this.prisma.contrato.findFirst({
      where: {
        clienteId: relatorio.clienteId,
        ativo: true,
        dataInicio: { lte: relatorio.dataVisita },
        OR: [{ dataFim: null }, { dataFim: { gte: relatorio.dataVisita } }],
      },
      select: { numeroContrato: true },
      orderBy: { dataInicio: "desc" },
    });

    await this.prisma.relatorio.update({
      where: { id: relatorio.id },
      data: { impresso: true },
    });

    return {
      ...relatorio,
      impresso: true,
      numeroContrato: contratoAtivo?.numeroContrato ?? null,
    };
  }

  async update(
    id: number,
    data: UpdateRelatorioInput,
    scopedUnidadeId: number | null,
    requesterRole: string | undefined,
    requesterUserId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.relatorio.findFirst({
        where:
          scopedUnidadeId === null
            ? { id }
            : { id, cliente: { unidadeId: scopedUnidadeId } },
        select: { id: true, criadoPorId: true, status: true },
      });

      if (!existing) {
        throw new Error("Relatório não encontrado");
      }

      this.ensureTecnicoPodeAlterarOuExcluir(
        requesterRole,
        requesterUserId,
        existing.criadoPorId,
        "atualizar",
      );

      if (existing.status === "CANCELADO") {
        throw new RelatorioStatusTransitionError(
          "Relatório cancelado não pode ser editado. " +
            "Reabra com PATCH /relatorios/:id/status (status AGENDADO)",
        );
      }

      if ((data as { status?: unknown }).status !== undefined) {
        throw new RelatorioStatusTransitionError(
          "Alteração de status deve usar PATCH /relatorios/:id/status",
        );
      }

      const updateData: Prisma.RelatorioUncheckedUpdateInput = {};

      if (data.clienteId !== undefined) {
        const targetCliente = await tx.cliente.findFirst({
          where:
            scopedUnidadeId === null
              ? { id: data.clienteId }
              : { id: data.clienteId, unidadeId: scopedUnidadeId },
          select: { id: true },
        });

        if (!targetCliente) {
          throw new Error("Cliente não pertence à sua unidade");
        }

        updateData.clienteId = data.clienteId;
      }

      if (data.contatoId !== undefined) {
        updateData.contatoId = data.contatoId;
      }

      if (data.dataVisita !== undefined) {
        updateData.dataVisita = parseDataVisita(data.dataVisita);
      }

      if (data.modalidade !== undefined || data.modalidadeServico !== undefined) {
        const modalidadeServico = resolverModalidadeServico(data);
        if (modalidadeServico !== undefined) {
          updateData.modalidadeServico = modalidadeServico;
        }
      }

      if (data.observacoes !== undefined) {
        updateData.observacoes = sanitizeRichTextHtml(data.observacoes);
      }

      if (data.impresso !== undefined) {
        updateData.impresso = data.impresso;
      }

      const updated = await tx.relatorio.update({
        where: { id },
        data: updateData,
      });

      await auditLogger(tx, {
        relatorioId: updated.id,
        usuarioId: requesterUserId,
        acao: "UPDATE",
      });

      // técnicos
      if (data.tecnicos !== undefined) {
        await tx.relatorioTecnico.deleteMany({
          where: { relatorioId: id },
        });

        if (data.tecnicos.length > 0) {
          await tx.relatorioTecnico.createMany({
            data: data.tecnicos.map(
              (nome): Prisma.RelatorioTecnicoCreateManyInput => ({
                relatorioId: id,
                nome,
              }),
            ),
          });
        }
      }

      // setores
      if (data.setores !== undefined) {
        await tx.relatorioSetor.deleteMany({
          where: { relatorioId: id },
        });

        if (data.setores.length > 0) {
          await tx.relatorioSetor.createMany({
            data: data.setores.map(
              (setor): Prisma.RelatorioSetorCreateManyInput => {
                const setorData: Prisma.RelatorioSetorCreateManyInput = {
                  relatorioId: id,
                  setorId: setor.setorId,
                };

                if (setor.observacao !== undefined) {
                  setorData.observacao = setor.observacao;
                }

                return setorData;
              },
            ),
          });
        }
      }

      // horários
      if (data.horarios !== undefined) {
        const horariosNormalizados = normalizeHorariosInput(data.horarios);

        if (Array.isArray(data.horarios) && data.horarios.length === 0) {
          await tx.relatorioHorario.deleteMany({
            where: { relatorioId: id },
          });
        } else if (horariosNormalizados.length > 0) {
          await tx.relatorioHorario.deleteMany({
            where: { relatorioId: id },
          });

          await tx.relatorioHorario.createMany({
            data: horariosNormalizados.map(
              (horario): Prisma.RelatorioHorarioCreateManyInput => ({
                relatorioId: id,
                horaChegada: parseHorario(
                  formatDataVisitaWallClock(updated.dataVisita),
                  horario.horaChegada,
                ),
                horaSaida: parseHorario(
                  formatDataVisitaWallClock(updated.dataVisita),
                  horario.horaSaida,
                ),
              }),
            ),
          });
        }
      }

      // checklists
      if (data.checklists !== undefined) {
        await tx.relatorioChecklist.deleteMany({
          where: { relatorioId: id },
        });

        if (data.checklists.length > 0) {
          await tx.relatorioChecklist.createMany({
            data: data.checklists.map(
              (check): Prisma.RelatorioChecklistCreateManyInput => ({
                relatorioId: id,
                checklistId: check.checklistId,
              }),
            ),
          });
        }
      }

      return tx.relatorio.findUnique({
        where: { id },
        include: {
          cliente: true,
          contato: true,
          criadoPor: {
            select: {
              id: true,
              nome: true,
              username: true,
            },
          },
          tecnicos: true,
          setores: {
            include: {
              setor: true,
            },
          },
          horarios: true,
          checklists: {
            include: {
              checklist: true,
            },
          },
        },
      });
    });
  }

  /**
   * Transição explícita de status (AGENDADO ↔ FINALIZADO ↔ CANCELADO).
   * Não altera conteúdo do relatório — use `update` para isso.
   */
  async updateStatus(
    id: number,
    statusRaw: unknown,
    scopedUnidadeId: number | null,
    requesterRole: string | undefined,
    requesterUserId: number,
  ) {
    const novoStatus = parseRelatorioStatus(statusRaw);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.relatorio.findFirst({
        where:
          scopedUnidadeId === null
            ? { id }
            : { id, cliente: { unidadeId: scopedUnidadeId } },
        select: { id: true, criadoPorId: true, status: true },
      });

      if (!existing) {
        throw new Error("Relatório não encontrado");
      }

      this.ensureTecnicoPodeAlterarOuExcluir(
        requesterRole,
        requesterUserId,
        existing.criadoPorId,
        "atualizar",
      );

      assertTransicaoStatusPermitida(existing.status, novoStatus);

      await tx.relatorio.update({
        where: { id },
        data: { status: novoStatus },
      });

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
            select: {
              id: true,
              nome: true,
              username: true,
            },
          },
          tecnicos: true,
          setores: {
            include: {
              setor: true,
            },
          },
          horarios: true,
          checklists: {
            include: {
              checklist: true,
            },
          },
        },
      });

      if (!updated) {
        throw new Error("Falha ao carregar relatório após mudança de status");
      }

      return {
        relatorio: updated,
        statusAnterior: existing.status as RelatorioStatus,
        statusAtual: updated.status,
        transicoesPermitidas: getTransicoesPermitidas(updated.status),
      };
    });
  }

  async delete(
    id: number,
    scopedUnidadeId: number | null,
    requesterRole: string | undefined,
    requesterUserId: number,
  ) {
    const scopedWhere: Prisma.RelatorioWhereInput =
      scopedUnidadeId === null
        ? { id }
        : { id, cliente: { unidadeId: scopedUnidadeId } };

    const registro = await this.prisma.relatorio.findFirst({
      where: scopedWhere,
      select: { id: true, criadoPorId: true },
    });

    if (!registro) {
      throw new Error("Relatório não encontrado");
    }

    this.ensureTecnicoPodeAlterarOuExcluir(
      requesterRole,
      requesterUserId,
      registro.criadoPorId,
      "excluir",
    );

    await this.prisma.$transaction(async (tx) => {
      await auditLogger(tx, {
        relatorioId: id,
        usuarioId: requesterUserId,
        acao: "DELETE",
      });

      await tx.relatorio.delete({
        where: { id },
      });
    });
  }

  async findAuditLogsByRelatorioId(
    relatorioId: number,
    scopedUnidadeId: number | null,
  ) {
    const relatorio = await this.prisma.relatorio.findFirst({
      where:
        scopedUnidadeId === null
          ? { id: relatorioId }
          : { id: relatorioId, cliente: { unidadeId: scopedUnidadeId } },
      select: { id: true },
    });

    if (!relatorio) {
      return null;
    }

    return this.prisma.auditLog.findMany({
      where: { relatorioId },
      orderBy: { timestamp: "desc" },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            username: true,
          },
        },
      },
    });
  }
}
