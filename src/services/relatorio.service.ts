import { PrismaClient, Prisma } from "@prisma/client";
import type {
  CreateRelatorioDTO,
  UpdateRelatorioDTO,
  RelatorioFilters,
} from "../types/dtos.js";
import { sanitizeRichTextHtml } from "../lib/sanitize-rich-text.js";
import { auditLogger } from "../lib/audit-logger.js";

// Helper: Combina data e hora para criar um DateTime válido
function combinarDataHora(data: string, hora: string): Date {
  // data: "2026-02-18", hora: "09:00"
  // resultado: "2026-02-18T09:00:00"
  return new Date(`${data}T${hora}:00`);
}

function parseHorario(dataVisita: string, horario: string): Date {
  if (horario.includes("T")) {
    const dateTime = new Date(horario);
    if (Number.isNaN(dateTime.getTime())) {
      throw new Error("Horario invalido (ISO 8601)");
    }
    return dateTime;
  }

  const [baseDate] = dataVisita.split("T");
  if (!baseDate) {
    throw new Error("Data da visita invalida");
  }
  const dateTime = combinarDataHora(baseDate, horario);
  if (Number.isNaN(dateTime.getTime())) {
    throw new Error("Horario invalido (HH:mm)");
  }
  return dateTime;
}

function parseDateFilter(dateValue: string, endOfDay = false): Date {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Data inválida para filtro: ${dateValue}`);
  }

  if (endOfDay) {
    parsed.setHours(23, 59, 59, 999);
  } else {
    parsed.setHours(0, 0, 0, 0);
  }

  return parsed;
}

const MODALIDADES_SERVICO = [
  "Sem contrato - remoto",
  "Sem contrato - local",
  "Contrato - local",
  "Contrato - remoto",
] as const;
type ModalidadeServico = (typeof MODALIDADES_SERVICO)[number];

type CreateRelatorioInput = CreateRelatorioDTO & { modalidade?: string };
type UpdateRelatorioInput = UpdateRelatorioDTO & { modalidade?: string };

function validarModalidadeServico(modalidade?: string): void {
  if (!modalidade) {
    return;
  }

  if (
    !MODALIDADES_SERVICO.includes(
      modalidade as (typeof MODALIDADES_SERVICO)[number],
    )
  ) {
    throw new Error("Modalidade de servico invalida");
  }
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
  validarModalidadeServico(modalidade);

  return modalidade as ModalidadeServico | undefined;
}

function validarModalidadePorContrato(
  modalidade: ModalidadeServico,
  possuiContratoAtivo: boolean,
): void {
  if (modalidade.startsWith("Contrato -") && !possuiContratoAtivo) {
    throw new Error(
      "Modalidade inválida: cliente sem contrato ativo na data da visita",
    );
  }

  if (modalidade.startsWith("Sem contrato -") && possuiContratoAtivo) {
    throw new Error(
      "Modalidade inválida: cliente possui contrato ativo na data da visita",
    );
  }
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
      const dataVisita = new Date(data.dataVisita);
      if (Number.isNaN(dataVisita.getTime())) {
        throw new Error("Data da visita inválida");
      }

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

      const possuiContratoAtivo = await tx.contrato.findFirst({
        where: {
          clienteId: data.clienteId,
          ativo: true,
          dataInicio: { lte: dataVisita },
          OR: [{ dataFim: null }, { dataFim: { gte: dataVisita } }],
        },
        select: { id: true },
      });
      validarModalidadePorContrato(modalidadeServico, Boolean(possuiContratoAtivo));

      const relatorioData: Prisma.RelatorioUncheckedCreateInput = {
        clienteId: data.clienteId,
        criadoPorId,
        dataVisita,
        modalidadeServico,
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
      if (data.horarios && data.horarios.length > 0) {
        const horariosCriados = await tx.relatorioHorario.createMany({
          data: data.horarios.map(
            (horario): Prisma.RelatorioHorarioCreateManyInput => ({
              relatorioId: relatorio.id,
              horaChegada: parseHorario(data.dataVisita, horario.horaChegada),
              horaSaida: parseHorario(data.dataVisita, horario.horaSaida),
            }),
          ),
        });
        if (horariosCriados.count !== data.horarios.length) {
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

    if (filters?.dataInicio || filters?.dataFim) {
      where.dataVisita = {};

      if (filters.dataInicio) {
        where.dataVisita.gte = parseDateFilter(filters.dataInicio);
      }

      if (filters.dataFim) {
        where.dataVisita.lte = parseDateFilter(filters.dataFim, true);
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

    await this.prisma.relatorio.update({
      where: { id: relatorio.id },
      data: { impresso: true },
    });

    return { ...relatorio, impresso: true };
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
        select: { id: true, criadoPorId: true },
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
        updateData.dataVisita = new Date(data.dataVisita);
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
        await tx.relatorioHorario.deleteMany({
          where: { relatorioId: id },
        });

        if (data.horarios.length > 0) {
          await tx.relatorioHorario.createMany({
            data: data.horarios.map(
              (horario): Prisma.RelatorioHorarioCreateManyInput => ({
                relatorioId: id,
                horaChegada: parseHorario(
                  updated.dataVisita.toISOString(),
                  horario.horaChegada,
                ),
                horaSaida: parseHorario(
                  updated.dataVisita.toISOString(),
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
