import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { isWithinConfiguredHorario } from "../lib/horario-utils.js";
import { systemActivityLogger } from "../lib/system-activity-logger.js";
import { resolveClientIp } from "../lib/resolve-client-ip.js";

export const HORARIO_LOGIN_DENIED_MESSAGE =
  "Login permitido apenas dentro do horario configurado";

function getLoginCredential(req: Request): string {
  const email =
    (typeof req.body?.email === "string" ? req.body.email.trim() : "") ||
    (typeof req.body?.username === "string" ? req.body.username.trim() : "");
  return email;
}

async function findLoginUserByCredential(credential: string): Promise<{
  id: number;
  role: string;
  ativo: boolean;
} | null> {
  if (!credential) {
    return null;
  }

  return credential.includes("@")
    ? prisma.user.findUnique({
        where: { email: credential },
        select: { id: true, role: true, ativo: true },
      })
    : prisma.user.findUnique({
        where: { username: credential },
        select: { id: true, role: true, ativo: true },
      });
}

/**
 * Bloqueia login fora do horário configurado (ADMIN sempre passa).
 */
export const horarioMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
  config: { dataInicio: Date; dataFim: Date } | null,
): Promise<void> => {
  if (!config) {
    next();
    return;
  }

  if (isWithinConfiguredHorario(config.dataInicio, config.dataFim)) {
    next();
    return;
  }

  const credential = getLoginCredential(req);
  const user = await findLoginUserByCredential(credential);

  if (user?.ativo === true && user.role === "ADMIN") {
    next();
    return;
  }

  void systemActivityLogger(prisma, {
    usuarioId: user?.id ?? null,
    acao: "LOGIN_FAILED",
    entidade: "AUTH",
    descricao: "Tentativa de login falhou",
    ipAddress: resolveClientIp(req),
    metadata: {
      credential: credential || null,
      reason: "outside_allowed_hours",
    },
  }).catch((error: unknown) => {
    console.error(
      "[activity-log] Falha ao registrar login fora do horário:",
      error,
    );
  });

  res.status(403).json({
    error: HORARIO_LOGIN_DENIED_MESSAGE,
  });
};
