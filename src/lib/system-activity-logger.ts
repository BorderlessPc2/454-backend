import type { Prisma, PrismaClient } from "@prisma/client";
import { getSystemActivityLogClient } from "./prisma-system-activity.js";

export const ACTIVITY_ENTITIES = [
  "USER",
  "CLIENTE",
  "RELATORIO",
  "CHECKLIST",
  "SETOR",
  "RAMO_ATIVIDADE",
  "CONFIGURACAO",
  "AUTH",
] as const;

export const ACTIVITY_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGIN_FAILED",
  "RESET_PASSWORD",
  "CHANGE_PASSWORD",
  "UPLOAD",
] as const;

export type ActivityEntity = (typeof ACTIVITY_ENTITIES)[number];
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export type SystemActivityLoggerInput = {
  /** Null quando a tentativa de login não resolve um usuário (credencial inexistente). */
  usuarioId?: number | null;
  acao: ActivityAction;
  entidade: ActivityEntity;
  entidadeId?: number | null;
  descricao?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Persistência de atividades do sistema para auditoria administrativa.
 * Aceita PrismaClient ou TransactionClient.
 */
export async function systemActivityLogger(
  db: DbClient,
  input: SystemActivityLoggerInput,
): Promise<void> {
  await getSystemActivityLogClient(db).create({
    data: {
      usuarioId: input.usuarioId ?? null,
      acao: input.acao,
      entidade: input.entidade,
      entidadeId: input.entidadeId ?? null,
      descricao: input.descricao ?? null,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ipAddress: input.ipAddress ?? null,
    },
    select: { id: true },
  });
}
