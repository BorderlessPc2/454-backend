export type RelatorioGerencialTipo =
  | "resumo-cliente"
  | "produtividade-tecnico"
  | "sla-contratos";

export type RelatorioGerencialFormato = "json" | "xlsx";

export type SlaStatus = "DENTRO" | "ABAIXO" | "SEM_META";

export interface RelatorioGerencialFilters {
  periodo: string;
  clienteId?: number;
  tecnicoId?: number;
  unidadeId?: number;
  scopedUnidadeId: number | null;
}

export interface ResumoClienteItem {
  clienteId: number;
  clienteNome: string;
  totalVisitas: number;
  totalHoras: number;
  totalSetoresVisitados: number;
  periodo: string;
}

export interface ResumoClienteResponse {
  tipo: "resumo-cliente";
  periodo: string;
  itens: ResumoClienteItem[];
}

export interface ProdutividadeTecnicoItem {
  tecnicoNome: string;
  totalVisitas: number;
  totalHoras: number;
  clientesAtendidos: number;
  periodo: string;
}

export interface ProdutividadeTecnicoResponse {
  tipo: "produtividade-tecnico";
  periodo: string;
  itens: ProdutividadeTecnicoItem[];
}

export interface SlaContratoItem {
  contratoId: number;
  clienteNome: string;
  visitasRealizadas: number;
  visitasEsperadas: number;
  slaPercentual: number | null;
  slaStatus: SlaStatus;
  periodo: string;
}

export interface SlaContratosResponse {
  tipo: "sla-contratos";
  periodo: string;
  itens: SlaContratoItem[];
}

export type RelatorioGerencialResponse =
  | ResumoClienteResponse
  | ProdutividadeTecnicoResponse
  | SlaContratosResponse;
