import type { Prisma, PrismaClient } from "@prisma/client";
import type { ActivityAction, ActivityEntity } from "./system-activity-logger.js";

export type SystemActivityLogRecord = {
  id: number;
  usuarioId: number;
  acao: ActivityAction;
  entidade: ActivityEntity;
  entidadeId: number | null;
  descricao: string | null;
  metadata: Prisma.JsonValue | null;
  ipAddress: string | null;
  timestamp: Date;
  usuario: {
    id: number;
    nome: string;
    username: string;
    role: string;
  };
};

type SystemActivityLogClient = {
  create: (args: {
    data: {
      usuarioId: number;
      acao: ActivityAction;
      entidade: ActivityEntity;
      entidadeId: number | null;
      descricao: string | null;
      metadata?: Prisma.InputJsonValue;
      ipAddress: string | null;
    };
    select: { id: true };
  }) => Promise<{ id: number }>;
  findMany: (args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, string>;
    skip?: number;
    take?: number;
    include?: Record<string, unknown>;
  }) => Promise<SystemActivityLogRecord[]>;
  count: (args: { where?: Record<string, unknown> }) => Promise<number>;
};

export function getSystemActivityLogClient(
  db: PrismaClient | Prisma.TransactionClient,
): SystemActivityLogClient {
  return (db as PrismaClient & { systemActivityLog: SystemActivityLogClient })
    .systemActivityLog;
}
