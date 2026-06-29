import type { ActivityAction, ActivityEntity } from "./system-activity-logger.js";

export type ParsedActivity = {
  entidade: ActivityEntity;
  acao: ActivityAction;
  entidadeId: number | null;
  descricao: string;
};

const ENTITY_LABELS: Record<ActivityEntity, string> = {
  USER: "usuário",
  CLIENTE: "cliente",
  RELATORIO: "relatório",
  CHECKLIST: "checklist",
  SETOR: "setor",
  RAMO_ATIVIDADE: "ramo de atividade",
  CONFIGURACAO: "configuração",
  AUTH: "autenticação",
};

const ACTION_LABELS: Record<ActivityAction, string> = {
  CREATE: "Criou",
  UPDATE: "Atualizou",
  DELETE: "Excluiu",
  LOGIN: "Realizou login",
  RESET_PASSWORD: "Redefiniu senha de",
  CHANGE_PASSWORD: "Alterou senha de",
  UPLOAD: "Enviou arquivo em",
};

function parseNumericId(value: string | undefined): number | null {
  if (!value) return null;
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function buildDescricao(
  acao: ActivityAction,
  entidade: ActivityEntity,
  entidadeId: number | null,
): string {
  const actionLabel = ACTION_LABELS[acao] ?? String(acao);
  const entityLabel = ENTITY_LABELS[entidade] ?? String(entidade);

  if (acao === "LOGIN") {
    return actionLabel;
  }

  if (entidadeId !== null) {
    return `${actionLabel} ${entityLabel} #${entidadeId}`;
  }

  return `${actionLabel} ${entityLabel}`;
}

function methodToAction(
  method: string,
  path: string,
): ActivityAction | null {
  const upper = method.toUpperCase();

  if (path.includes("/password")) {
    return upper === "PUT" ? "CHANGE_PASSWORD" : null;
  }

  if (path.includes("/reset-password")) {
    return "RESET_PASSWORD";
  }

  if (path.includes("/logo")) {
    return "UPLOAD";
  }

  switch (upper) {
    case "POST":
      return "CREATE";
    case "PUT":
    case "PATCH":
      return "UPDATE";
    case "DELETE":
      return "DELETE";
    default:
      return null;
  }
}

function resolveEntity(path: string): ActivityEntity | null {
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const root = segments[0];

  switch (root) {
    case "users":
      return "USER";
    case "clientes":
      return "CLIENTE";
    case "relatorios":
      return "RELATORIO";
    case "checklists":
      return "CHECKLIST";
    case "setores":
      return "SETOR";
    case "ramos":
      return "RAMO_ATIVIDADE";
    case "configuracoes":
      return "CONFIGURACAO";
    case "auth":
      return "AUTH";
    default:
      return null;
  }
}

/**
 * Interpreta método HTTP + path para gerar metadados de auditoria.
 */
export function parseActivityFromRequest(
  method: string,
  path: string,
  params: Record<string, string>,
): ParsedActivity | null {
  const normalizedPath = path.split("?")[0] ?? path;

  if (normalizedPath.startsWith("/admin/activity-logs")) {
    return null;
  }

  const entidade = resolveEntity(normalizedPath);
  if (!entidade) return null;

  const acao = methodToAction(method, normalizedPath);
  if (!acao) return null;

  const entidadeId =
    parseNumericId(params["id"]) ??
  parseNumericId(params["relatorioId"]) ??
    null;

  return {
    entidade,
    acao,
    entidadeId,
    descricao: buildDescricao(acao, entidade, entidadeId),
  };
}
