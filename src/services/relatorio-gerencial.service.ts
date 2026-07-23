import { Prisma, PrismaClient } from "@prisma/client";
import { parsePeriodoYYYYMM } from "../lib/parse-periodo.js";
import {
  calcularTotalHorasDecimal,
  formatHorasDecimalAsHhmm,
} from "../lib/relatorio-gerencial-horas.js";
import type {
  ProdutividadeTecnicoItem,
  ProdutividadeTecnicoResponse,
  RelatorioGerencialFilters,
  RelatorioGerencialResponse,
  RelatorioGerencialTipo,
  ResumoClienteItem,
  ResumoClienteResponse,
  SlaContratoItem,
  SlaContratosResponse,
  SlaStatus,
} from "../types/relatorio-gerencial.js";

type RelatorioComAgregacao = {
  id: number;
  clienteId: number;
  cliente: { id: number; nomeFantasia: string };
  horarios: { horaChegada: Date; horaSaida: Date }[];
  setores: { setorId: number }[];
  tecnicos: { nome: string }[];
};

function resolveClienteWhere(
  _filters: RelatorioGerencialFilters,
): Prisma.ClienteWhereInput | undefined {
  // Cliente não possui mais unidadeId — filtros por unidade não se aplicam.
  return undefined;
}

function buildRelatorioWhere(
  filters: RelatorioGerencialFilters,
  options?: { onlyFinalizados?: boolean },
): Prisma.RelatorioWhereInput {
  const { inicio, fim } = parsePeriodoYYYYMM(filters.periodo);
  const clienteWhere = resolveClienteWhere(filters);

  const where: Prisma.RelatorioWhereInput = {
    dataVisita: { gte: inicio, lte: fim },
    status: options?.onlyFinalizados
      ? "FINALIZADO"
      : { not: "CANCELADO" },
  };

  if (filters.clienteId !== undefined) {
    where.clienteId = filters.clienteId;
  }

  if (clienteWhere) {
    where.cliente = clienteWhere;
  }

  return where;
}

export function aggregateResumoCliente(
  relatorios: RelatorioComAgregacao[],
  periodo: string,
): ResumoClienteItem[] {
  const map = new Map<
    number,
    {
      clienteNome: string;
      totalVisitas: number;
      totalHoras: number;
      setores: Set<number>;
    }
  >();

  for (const rel of relatorios) {
    const entry = map.get(rel.clienteId) ?? {
      clienteNome: rel.cliente.nomeFantasia,
      totalVisitas: 0,
      totalHoras: 0,
      setores: new Set<number>(),
    };

    entry.totalVisitas += 1;
    entry.totalHoras += calcularTotalHorasDecimal(rel.horarios);
    for (const s of rel.setores) {
      entry.setores.add(s.setorId);
    }

    map.set(rel.clienteId, entry);
  }

  return [...map.entries()]
    .map(([clienteId, data]) => ({
      clienteId,
      clienteNome: data.clienteNome,
      totalVisitas: data.totalVisitas,
      totalHoras: Math.round(data.totalHoras * 100) / 100,
      totalSetoresVisitados: data.setores.size,
      periodo,
    }))
    .sort((a, b) => a.clienteNome.localeCompare(b.clienteNome, "pt-BR"));
}

export function aggregateProdutividadeTecnico(
  relatorios: RelatorioComAgregacao[],
  periodo: string,
  tecnicoNomeFilter?: string,
): ProdutividadeTecnicoItem[] {
  const map = new Map<
    string,
    {
      totalVisitas: number;
      totalHoras: number;
      clientes: Set<number>;
    }
  >();

  const normalizedFilter = tecnicoNomeFilter?.trim().toLowerCase();

  for (const rel of relatorios) {
    const horasRelatorio = calcularTotalHorasDecimal(rel.horarios);

    for (const tecnico of rel.tecnicos) {
      const nome = tecnico.nome.trim();
      if (!nome) {
        continue;
      }

      if (
        normalizedFilter &&
        nome.toLowerCase() !== normalizedFilter
      ) {
        continue;
      }

      const entry = map.get(nome) ?? {
        totalVisitas: 0,
        totalHoras: 0,
        clientes: new Set<number>(),
      };

      entry.totalVisitas += 1;
      entry.totalHoras += horasRelatorio;
      entry.clientes.add(rel.clienteId);
      map.set(nome, entry);
    }
  }

  return [...map.entries()]
    .map(([tecnicoNome, data]) => ({
      tecnicoNome,
      totalVisitas: data.totalVisitas,
      totalHoras: Math.round(data.totalHoras * 100) / 100,
      clientesAtendidos: data.clientes.size,
      periodo,
    }))
    .sort((a, b) => a.tecnicoNome.localeCompare(b.tecnicoNome, "pt-BR"));
}

export function computeSlaStatus(
  visitasRealizadas: number,
  visitasEsperadas: number,
): { slaPercentual: number | null; slaStatus: SlaStatus } {
  if (visitasEsperadas <= 0) {
    return { slaPercentual: null, slaStatus: "SEM_META" };
  }

  const slaPercentual =
    Math.round((visitasRealizadas / visitasEsperadas) * 10000) / 100;

  return {
    slaPercentual,
    slaStatus: visitasRealizadas >= visitasEsperadas ? "DENTRO" : "ABAIXO",
  };
}

export function aggregateSlaContratos(
  contratos: Array<{
    id: number;
    visitasMensaisEsperadas: number | null;
    cliente: { nomeFantasia: string };
  }>,
  visitasPorCliente: Map<number, number>,
  periodo: string,
): SlaContratoItem[] {
  return contratos
    .map((contrato) => {
      const visitasEsperadas = contrato.visitasMensaisEsperadas ?? 0;
      const visitasRealizadas = visitasPorCliente.get(contrato.id) ?? 0;
      const { slaPercentual, slaStatus } = computeSlaStatus(
        visitasRealizadas,
        visitasEsperadas,
      );

      return {
        contratoId: contrato.id,
        clienteNome: contrato.cliente.nomeFantasia,
        visitasRealizadas,
        visitasEsperadas,
        slaPercentual,
        slaStatus,
        periodo,
      };
    })
    .sort((a, b) => a.clienteNome.localeCompare(b.clienteNome, "pt-BR"));
}

export class RelatorioGerencialService {
  constructor(private prisma: PrismaClient) {}

  private async fetchRelatoriosParaAgregacao(
    filters: RelatorioGerencialFilters,
    onlyFinalizados = false,
  ): Promise<RelatorioComAgregacao[]> {
    return this.prisma.relatorio.findMany({
      where: buildRelatorioWhere(filters, { onlyFinalizados }),
      select: {
        id: true,
        clienteId: true,
        cliente: {
          select: { id: true, nomeFantasia: true },
        },
        horarios: {
          select: { horaChegada: true, horaSaida: true },
        },
        setores: {
          select: { setorId: true },
        },
        tecnicos: {
          select: { nome: true },
        },
      },
    });
  }

  async getResumoCliente(
    filters: RelatorioGerencialFilters,
  ): Promise<ResumoClienteResponse> {
    const { periodo } = parsePeriodoYYYYMM(filters.periodo);
    const relatorios = await this.fetchRelatoriosParaAgregacao(filters);

    return {
      tipo: "resumo-cliente",
      periodo,
      itens: aggregateResumoCliente(relatorios, periodo),
    };
  }

  async getProdutividadeTecnico(
    filters: RelatorioGerencialFilters,
  ): Promise<ProdutividadeTecnicoResponse> {
    const { periodo } = parsePeriodoYYYYMM(filters.periodo);

    let tecnicoNomeFilter: string | undefined;
    if (filters.tecnicoId !== undefined) {
      const tecnico = await this.prisma.user.findUnique({
        where: { id: filters.tecnicoId },
        select: { nome: true, role: true },
      });
      if (!tecnico) {
        throw new Error("Técnico não encontrado");
      }
      tecnicoNomeFilter = tecnico.nome;
    }

    const relatorios = await this.fetchRelatoriosParaAgregacao(filters);

    return {
      tipo: "produtividade-tecnico",
      periodo,
      itens: aggregateProdutividadeTecnico(
        relatorios,
        periodo,
        tecnicoNomeFilter,
      ),
    };
  }

  async getSlaContratos(
    filters: RelatorioGerencialFilters,
  ): Promise<SlaContratosResponse> {
    const { periodo, inicio, fim } = parsePeriodoYYYYMM(filters.periodo);
    const clienteWhere = resolveClienteWhere(filters);

    const contratoWhere: Prisma.ContratoWhereInput = {
      ativo: true,
      dataInicio: { lte: fim },
      OR: [{ dataFim: null }, { dataFim: { gte: inicio } }],
    };

    if (filters.clienteId !== undefined) {
      contratoWhere.clienteId = filters.clienteId;
    }

    if (clienteWhere) {
      contratoWhere.cliente = clienteWhere;
    }

    const contratos = await this.prisma.contrato.findMany({
      where: contratoWhere,
      select: {
        id: true,
        clienteId: true,
        visitasMensaisEsperadas: true,
        cliente: { select: { nomeFantasia: true } },
      },
    });

    const clienteIds = [...new Set(contratos.map((c) => c.clienteId))];

    const visitasPorCliente = new Map<number, number>();

    if (clienteIds.length > 0) {
      const grouped = await this.prisma.relatorio.groupBy({
        by: ["clienteId"],
        where: {
          clienteId: { in: clienteIds },
          status: "FINALIZADO",
          dataVisita: { gte: inicio, lte: fim },
        },
        _count: { id: true },
      });

      for (const row of grouped) {
        visitasPorCliente.set(row.clienteId, row._count.id);
      }
    }

    const visitasPorContrato = new Map<number, number>();
    for (const contrato of contratos) {
      const count = visitasPorCliente.get(contrato.clienteId) ?? 0;
      visitasPorContrato.set(contrato.id, count);
    }

    return {
      tipo: "sla-contratos",
      periodo,
      itens: aggregateSlaContratos(
        contratos,
        visitasPorContrato,
        periodo,
      ),
    };
  }

  async getByTipo(
    tipo: RelatorioGerencialTipo,
    filters: RelatorioGerencialFilters,
  ): Promise<RelatorioGerencialResponse> {
    switch (tipo) {
      case "resumo-cliente":
        return this.getResumoCliente(filters);
      case "produtividade-tecnico":
        return this.getProdutividadeTecnico(filters);
      case "sla-contratos":
        return this.getSlaContratos(filters);
      default:
        throw new Error("tipo inválido");
    }
  }
}

export { formatHorasDecimalAsHhmm };
