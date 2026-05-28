import type { Prisma } from "@prisma/client";

export type AuditLoggerInput = {
  relatorioId: number;
  usuarioId: number;
  acao: "CREATE" | "UPDATE" | "DELETE";
};

/**
 * Persistência de auditoria para alterações em relatório.
 * Use sempre com TransactionClient para manter atomicidade com a operação principal.
 */
export async function auditLogger(
  tx: Prisma.TransactionClient,
  input: AuditLoggerInput,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      relatorioId: input.relatorioId,
      usuarioId: input.usuarioId,
      acao: input.acao as Prisma.AuditLogCreateInput["acao"],
    },
    select: { id: true },
  });
}

