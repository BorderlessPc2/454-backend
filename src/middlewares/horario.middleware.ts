import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { isWithinConfiguredHorario } from "../lib/horario-utils.js";

export const HORARIO_LOGIN_DENIED_MESSAGE =
  "Login permitido apenas dentro do horario configurado";

function getLoginCredential(req: Request): string {
  const email =
    (typeof req.body?.email === "string" ? req.body.email.trim() : "") ||
    (typeof req.body?.username === "string" ? req.body.username.trim() : "");
  return email;
}

async function isAdminLoginCredential(credential: string): Promise<boolean> {
  if (!credential) {
    return false;
  }

  const user = credential.includes("@")
    ? await prisma.user.findUnique({
        where: { email: credential },
        select: { role: true, ativo: true },
      })
    : await prisma.user.findUnique({
        where: { username: credential },
        select: { role: true, ativo: true },
      });

  return user?.ativo === true && user.role === "ADMIN";
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
  if (credential && (await isAdminLoginCredential(credential))) {
    next();
    return;
  }

  res.status(403).json({
    error: HORARIO_LOGIN_DENIED_MESSAGE,
  });
};
