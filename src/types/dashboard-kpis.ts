export interface DashboardKpisFilters {
  inicio: Date;
  fim: Date;
  dataInicio: string;
  dataFim: string;
  scopedUnidadeId: number | null;
  unidadeId?: number;
  tecnicoId?: number;
  clienteId?: number;
  setorId?: number;
  tecnicoNomeFilter?: string;
  /** TECNICO: restringe relatórios ao próprio usuário. */
  restrictToUserId?: number;
  restrictToUserNome?: string;
}

export interface VisitasSlaKpi {
  realizadas: number;
  esperadas: number;
}

export interface ContratoSlaRiscoItem {
  clienteId: number;
  clienteNomeFantasia: string;
  contratoId: number;
  visitasRealizadas: number;
  visitasEsperadas: number;
  percentualConcluido: number;
}

export interface ProdutividadeTecnicoKpiItem {
  tecnicoId: number | null;
  tecnicoNome: string;
  totalVisitas: number;
  totalHoras: string;
}

export interface TopClienteKpiItem {
  clienteId: number;
  clienteNomeFantasia: string;
  totalVisitas: number;
}

export interface DashboardKpisAdminResponse {
  visitasSla: VisitasSlaKpi;
  totalHoras: string;
  contratosSlaRisco: ContratoSlaRiscoItem[];
  produtividadeTecnicos: ProdutividadeTecnicoKpiItem[];
  topClientes: TopClienteKpiItem[];
}

export interface DashboardKpisTecnicoVisitas {
  realizadas: number;
  agendadas: number;
}

export interface DashboardKpisTecnicoResponse {
  visitas: DashboardKpisTecnicoVisitas;
  totalHoras: string;
  topClientes: TopClienteKpiItem[];
}

export type DashboardKpisResponse =
  | DashboardKpisAdminResponse
  | DashboardKpisTecnicoResponse;
