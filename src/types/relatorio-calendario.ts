import type { RelatorioStatus } from "@prisma/client";

export interface CalendarioFilters {
  dataInicio: string;
  dataFim: string;
  clienteId?: number;
  tecnicoId?: number;
  scopedUnidadeId: number | null;
}

export interface CalendarioEventExtendedProps {
  clienteId: number;
  clienteNome: string;
  status: RelatorioStatus;
  tecnicos: string[];
  modalidade: string;
  impresso: boolean;
  criadoPorId: number;
}

export interface CalendarioEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  extendedProps: CalendarioEventExtendedProps;
}

export interface ReagendarDataVisitaDTO {
  dataVisita: string;
}

export interface CreateAgendamentoDTO {
  clienteId: number;
  dataVisita: string;
  tecnicos: string[];
  status?: "AGENDADO";
}
