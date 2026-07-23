export interface CalendarioEventoFilters {
  dataInicio: string;
  dataFim: string;
  clienteId?: number;
  criadoPorId?: number;
}

export interface CreateCalendarioEventoDTO {
  titulo: string;
  descricao?: string | null;
  /** YYYY-MM-DD (inclusivo) */
  dataInicio: string;
  /** YYYY-MM-DD (inclusivo). Pode ser igual a dataInicio. */
  dataFim: string;
  clienteId?: number | null;
}

export interface UpdateCalendarioEventoDTO {
  titulo?: string;
  descricao?: string | null;
  dataInicio?: string;
  dataFim?: string;
  clienteId?: number | null;
}

export interface CalendarioEventoExtendedProps {
  dataInicio: string;
  dataFim: string;
  descricao: string | null;
  clienteId: number | null;
  clienteNome: string | null;
  criadoPorId: number;
  criadoPorNome: string;
}

/**
 * Formato FullCalendar.
 * `start`/`end` com `allDay: true`: `end` é **exclusivo** (dia seguinte a dataFim),
 * para o FC pintar todos os dias inclusivos.
 */
export interface CalendarioEventoResponse {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: true;
  classNames: string[];
  extendedProps: CalendarioEventoExtendedProps;
}
