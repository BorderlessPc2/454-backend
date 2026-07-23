import { Prisma, type PrismaClient } from "@prisma/client";
import { calcularTotalHorasDecimal } from "../lib/relatorio-gerencial-horas.js";
import {
  computePercentualConcluido,
  formatHorasKpiString,
  getCurrentMonthRangeToToday,
  getFirstMonthRangeFromPeriod,
} from "../lib/dashboard-period.js";
import type {
  ContratoSlaRiscoItem,
  DashboardKpisAdminResponse,
  DashboardKpisFilters,
  DashboardKpisTecnicoResponse,
  ProdutividadeTecnicoKpiItem,
  TopClienteKpiItem,
} from "../types/dashboard-kpis.js";

const TOP_CLIENTES_LIMIT = 10;

type RelatorioAgregacaoRow = {
  id: number;
  clienteId: number;
  cliente: { id: number; nomeFantasia: string };
  horarios: { horaChegada: Date; horaSaida: Date }[];
  tecnicos: { nome: string }[];
};

function buildClienteWhere(
  _filters: DashboardKpisFilters,
): Prisma.ClienteWhereInput | undefined {
  // Cliente não possui mais unidadeId — filtros por unidade não se aplicam.
  return undefined;
}

function buildRelatorioWhere(
  filters: DashboardKpisFilters,
  options?: {
    status?: Prisma.EnumRelatorioStatusFilter | "FINALIZADO";
    dateRange?: { inicio: Date; fim: Date };
  },
): Prisma.RelatorioWhereInput {
  const range = options?.dateRange ?? {
    inicio: filters.inicio,
    fim: filters.fim,
  };

  const where: Prisma.RelatorioWhereInput = {
    dataVisita: { gte: range.inicio, lte: range.fim },
  };

  if (options?.status !== undefined) {
    where.status =
      options.status === "FINALIZADO"
        ? "FINALIZADO"
        : options.status;
  }

  if (filters.clienteId !== undefined) {
    where.clienteId = filters.clienteId;
  }

  const clienteWhere = buildClienteWhere(filters);
  if (clienteWhere) {
    where.cliente = clienteWhere;
  }

  if (filters.tecnicoNomeFilter) {
    where.tecnicos = {
      some: {
        nome: { equals: filters.tecnicoNomeFilter, mode: "insensitive" },
      },
    };
  }

  if (filters.setorId !== undefined) {
    where.setores = {
      some: { setorId: filters.setorId },
    };
  }

  if (
    filters.restrictToUserId !== undefined &&
    filters.restrictToUserNome
  ) {
    where.OR = [
      { criadoPorId: filters.restrictToUserId },
      {
        tecnicos: {
          some: {
            nome: {
              equals: filters.restrictToUserNome,
              mode: "insensitive",
            },
          },
        },
      },
    ];
  }

  return where;
}

function buildContratoWhere(
  filters: DashboardKpisFilters,
  range: { inicio: Date; fim: Date },
): Prisma.ContratoWhereInput {
  const where: Prisma.ContratoWhereInput = {
    ativo: true,
    dataInicio: { lte: range.fim },
    OR: [{ dataFim: null }, { dataFim: { gte: range.inicio } }],
    visitasMensaisEsperadas: { gt: 0 },
  };

  if (filters.clienteId !== undefined) {
    where.clienteId = filters.clienteId;
  }

  const clienteWhere = buildClienteWhere(filters);
  if (clienteWhere) {
    where.cliente = clienteWhere;
  }

  return where;
}

function aggregateTopClientes(
  relatorios: RelatorioAgregacaoRow[],
  limit: number,
): TopClienteKpiItem[] {
  const map = new Map<
    number,
    { clienteNomeFantasia: string; totalVisitas: number }
  >();

  for (const rel of relatorios) {
    const entry = map.get(rel.clienteId) ?? {
      clienteNomeFantasia: rel.cliente.nomeFantasia,
      totalVisitas: 0,
    };
    entry.totalVisitas += 1;
    map.set(rel.clienteId, entry);
  }

  return [...map.entries()]
    .map(([clienteId, data]) => ({
      clienteId,
      clienteNomeFantasia: data.clienteNomeFantasia,
      totalVisitas: data.totalVisitas,
    }))
    .sort((a, b) => b.totalVisitas - a.totalVisitas)
    .slice(0, limit);
}

function aggregateProdutividade(
  relatorios: RelatorioAgregacaoRow[],
  nomeToUserId: Map<string, number>,
): ProdutividadeTecnicoKpiItem[] {
  const map = new Map<
    string,
    { totalVisitas: number; totalHoras: number }
  >();

  for (const rel of relatorios) {
    const horas = calcularTotalHorasDecimal(rel.horarios);
    const nomesUnicos = new Set(
      rel.tecnicos
        .map((t) => t.nome.trim())
        .filter((nome) => nome.length > 0),
    );

    for (const nome of nomesUnicos) {
      const entry = map.get(nome) ?? { totalVisitas: 0, totalHoras: 0 };
      entry.totalVisitas += 1;
      entry.totalHoras += horas;
      map.set(nome, entry);
    }
  }

  return [...map.entries()]
    .map(([tecnicoNome, data]) => ({
      tecnicoId: nomeToUserId.get(tecnicoNome.toLowerCase()) ?? null,
      tecnicoNome,
      totalVisitas: data.totalVisitas,
      totalHoras: formatHorasKpiString(data.totalHoras),
    }))
    .sort((a, b) => b.totalVisitas - a.totalVisitas);
}

function sumHorasFromRelatorios(relatorios: RelatorioAgregacaoRow[]): string {
  let total = 0;
  for (const rel of relatorios) {
    total += calcularTotalHorasDecimal(rel.horarios);
  }
  return formatHorasKpiString(total);
}

export class DashboardKpisService {
  constructor(private prisma: PrismaClient) {}

  private async fetchRelatoriosFinalizados(
    filters: DashboardKpisFilters,
    dateRange?: { inicio: Date; fim: Date },
  ): Promise<RelatorioAgregacaoRow[]> {
    const whereOptions: {
      status: "FINALIZADO";
      dateRange?: { inicio: Date; fim: Date };
    } = { status: "FINALIZADO" };

    if (dateRange !== undefined) {
      whereOptions.dateRange = dateRange;
    }

    return this.prisma.relatorio.findMany({
      where: buildRelatorioWhere(filters, whereOptions),
      select: {
        id: true,
        clienteId: true,
        cliente: {
          select: { id: true, nomeFantasia: true },
        },
        horarios: {
          select: { horaChegada: true, horaSaida: true },
        },
        tecnicos: {
          select: { nome: true },
        },
      },
    });
  }

  private async buildNomeToUserIdMap(): Promise<Map<string, number>> {
    const users = await this.prisma.user.findMany({
      where: {
        ativo: true,
        role: { in: ["ADMIN", "TECNICO"] },
      },
      select: { id: true, nome: true },
    });

    const map = new Map<string, number>();
    for (const user of users) {
      const key = user.nome.trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, user.id);
      }
    }
    return map;
  }

  private async countVisitasEsperadas(
    filters: DashboardKpisFilters,
  ): Promise<number> {
    const firstMonth = getFirstMonthRangeFromPeriod(filters.inicio);
    const contratos = await this.prisma.contrato.findMany({
      where: buildContratoWhere(filters, firstMonth),
      select: { visitasMensaisEsperadas: true },
    });

    return contratos.reduce(
      (sum, c) => sum + (c.visitasMensaisEsperadas ?? 0),
      0,
    );
  }

  private async getContratosSlaRisco(
    filters: DashboardKpisFilters,
  ): Promise<ContratoSlaRiscoItem[]> {
    const mesAtual = getCurrentMonthRangeToToday();
    const contratoWhere = buildContratoWhere(filters, mesAtual);

    const contratos = await this.prisma.contrato.findMany({
      where: contratoWhere,
      select: {
        id: true,
        clienteId: true,
        visitasMensaisEsperadas: true,
        cliente: { select: { nomeFantasia: true } },
      },
    });

    if (contratos.length === 0) {
      return [];
    }

    const clienteIds = [...new Set(contratos.map((c) => c.clienteId))];
    const relatorioWhere = buildRelatorioWhere(filters, {
      status: "FINALIZADO",
      dateRange: mesAtual,
    });
    const grouped = await this.prisma.relatorio.groupBy({
      by: ["clienteId"],
      where: {
        ...relatorioWhere,
        clienteId: { in: clienteIds },
      },
      _count: { id: true },
    });

    const visitasPorCliente = new Map<number, number>();
    for (const row of grouped) {
      visitasPorCliente.set(row.clienteId, row._count.id);
    }

    const risco: ContratoSlaRiscoItem[] = [];

    for (const contrato of contratos) {
      const esperadas = contrato.visitasMensaisEsperadas ?? 0;
      if (esperadas <= 0) {
        continue;
      }

      const realizadas = visitasPorCliente.get(contrato.clienteId) ?? 0;
      if (realizadas >= esperadas) {
        continue;
      }

      risco.push({
        clienteId: contrato.clienteId,
        clienteNomeFantasia: contrato.cliente.nomeFantasia,
        contratoId: contrato.id,
        visitasRealizadas: realizadas,
        visitasEsperadas: esperadas,
        percentualConcluido: computePercentualConcluido(realizadas, esperadas),
      });
    }

    return risco.sort(
      (a, b) => a.percentualConcluido - b.percentualConcluido,
    );
  }

  async getAdminKpis(
    filters: DashboardKpisFilters,
  ): Promise<DashboardKpisAdminResponse> {
    const relatorioWhere = buildRelatorioWhere(filters, {
      status: "FINALIZADO",
    });

    const [visitasRealizadas, visitasEsperadas, relatorios, contratosSlaRisco] =
      await Promise.all([
        this.prisma.relatorio.count({ where: relatorioWhere }),
        this.countVisitasEsperadas(filters),
        this.fetchRelatoriosFinalizados(filters),
        this.getContratosSlaRisco(filters),
      ]);

    const nomeToUserId = await this.buildNomeToUserIdMap();

    return {
      visitasSla: {
        realizadas: visitasRealizadas,
        esperadas: visitasEsperadas,
      },
      totalHoras: sumHorasFromRelatorios(relatorios),
      contratosSlaRisco,
      produtividadeTecnicos: aggregateProdutividade(relatorios, nomeToUserId),
      topClientes: aggregateTopClientes(relatorios, TOP_CLIENTES_LIMIT),
    };
  }

  async getTecnicoKpis(
    filters: DashboardKpisFilters,
  ): Promise<DashboardKpisTecnicoResponse> {
    const baseWhere = buildRelatorioWhere(filters);

    const [realizadas, agendadas, relatorios] = await Promise.all([
      this.prisma.relatorio.count({
        where: { ...baseWhere, status: "FINALIZADO" },
      }),
      this.prisma.relatorio.count({
        where: { ...baseWhere, status: "AGENDADO" },
      }),
      this.fetchRelatoriosFinalizados(filters),
    ]);

    return {
      visitas: { realizadas, agendadas },
      totalHoras: sumHorasFromRelatorios(relatorios),
      topClientes: aggregateTopClientes(relatorios, TOP_CLIENTES_LIMIT),
    };
  }

  async assertSetorExists(setorId: number): Promise<void> {
    const setor = await this.prisma.setor.findUnique({
      where: { id: setorId },
      select: { id: true },
    });

    if (!setor) {
      throw new Error("Setor não encontrado");
    }
  }

  async resolveTecnicoNome(tecnicoId: number): Promise<string> {
    const tecnico = await this.prisma.user.findUnique({
      where: { id: tecnicoId },
      select: { nome: true, role: true, ativo: true },
    });

    if (!tecnico || !tecnico.ativo) {
      throw new Error("Técnico não encontrado");
    }

    if (tecnico.role !== "TECNICO" && tecnico.role !== "ADMIN") {
      throw new Error("Técnico não encontrado");
    }

    return tecnico.nome;
  }
}
