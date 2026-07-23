export interface LoginDTO {
  username?: string;
  email?: string;
  password: string;
}

export interface CreateUserDTO {
  username: string;
  password: string;
  nome: string;
  email: string;
  role: "ADMIN" | "TECNICO";
  /** Opcional — vínculo com cliente (sem efeito sobre unidade). */
  clienteId?: number | null;
  /** Opcional/legado — não derivar de cliente. */
  unidadeId?: number;
}

export interface UpdateUserDTO {
  nome?: string;
  email?: string;
  role?: "ADMIN" | "TECNICO";
  /** null remove o vínculo com cliente. */
  clienteId?: number | null;
  /** Opcional/legado — não derivar de cliente. */
  unidadeId?: number | null;
  ativo?: boolean;
}

export interface ChangePasswordDTO {
  newPassword: string;
}

export interface CreateContatoDTO {
  nome: string;
  cargo?: string;
  telefone?: string;
  email?: string;
  principal?: boolean;
}

export interface CreateContratoDTO {
  numeroContrato: string;
  dataInicio: string;
  dataFim: string;
  valorMensal: number;
  descricaoServicos: string;
  condicoes?: string;
}

export interface CreateClienteDTO {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual?: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  telefone?: string;
  email?: string;
  ramoAtividadeId: number;
  contato: CreateContatoDTO;
  contrato: CreateContratoDTO;
}

export interface UpdateContatoDTO {
  nome?: string;
  cargo?: string;
  telefone?: string;
  email?: string;
  principal?: boolean;
}

export interface UpdateContratoDTO {
  numeroContrato?: string;
  dataInicio?: string;
  dataFim?: string;
  valorMensal?: number;
  descricaoServicos?: string;
  condicoes?: string;
}

export interface UpdateClienteDTO {
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  inscricaoEstadual?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  ramoAtividadeId?: number;
  ativo?: boolean;
  contato?: UpdateContatoDTO;
  contrato?: UpdateContratoDTO;
}

export interface CreateChecklistDTO {
  nome: string;
  descricao?: string;
  indice?: number;
  itens?: ChecklistItemPayloadDTO[];
}

export interface UpdateChecklistDTO {
  nome?: string;
  descricao?: string;
  indice?: number;
  ativo?: boolean;
  itens?: ChecklistItemPayloadDTO[];
}

export interface ChecklistItemPayloadDTO {
  texto: string;
  ordem: number;
}

export interface ReorderChecklistItemDTO {
  id: number;
  indice: number;
}

export interface ReorderChecklistDTO {
  items: ReorderChecklistItemDTO[];
}

export interface CreateRelatorioDTO {
  clienteId: number;
  contatoId?: number;
  dataVisita: string;
  /** Local ou remoto; contrato ativo vem do cadastro do cliente. */
  modalidadeServico: "local" | "remoto";
  observacoes?: string;
  /**
   * Opcional. Create de visita concluída usa `FINALIZADO` (default).
   * Status `AGENDADO` legado não deve ser enviado aqui.
   * Organização da equipe: use `POST /calendario/eventos` (não cria relatório).
   */
  status?: "FINALIZADO";
  tecnicos: string[];
  setores: Array<{ setorId: number; observacao?: string }>;
  horarios?: Array<{ horaChegada: string; horaSaida: string }>;
  checklists: Array<{ checklistId: number }>;
}

export interface UpdateRelatorioDTO {
  clienteId?: number;
  contatoId?: number;
  dataVisita?: string;
  /** Local ou remoto; contrato ativo vem do cadastro do cliente. */
  modalidadeServico?: "local" | "remoto";
  observacoes?: string;
  impresso?: boolean;
  tecnicos?: string[];
  setores?: Array<{ setorId: number; observacao?: string }>;
  horarios?: Array<{ horaChegada: string; horaSaida: string }>;
  checklists?: Array<{ checklistId: number }>;
}

/** Body de `PATCH /relatorios/:id/status`. */
export interface UpdateRelatorioStatusDTO {
  status: "AGENDADO" | "FINALIZADO" | "CANCELADO";
}

export interface RelatorioFilters {
  clienteId?: number;
  dataInicio?: string;
  dataFim?: string;
  criadoPorId?: number;
  impresso?: boolean;
  /** Um ou mais status (`AGENDADO`, `FINALIZADO`, `CANCELADO`). */
  status?: Array<"AGENDADO" | "FINALIZADO" | "CANCELADO">;
}

export interface ClienteFilters {
  nomeFantasia?: string;
  cnpj?: string;
  ramoAtividadeId?: number;
}
