import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.middleware.js";
import { ServiceUnavailableError } from "../lib/app-error.js";
import { prisma } from "../lib/prisma.js";
import { isWithinConfiguredHorario } from "../lib/horario-utils.js";

export const HORARIO_ACCESS_DENIED_MESSAGE =
  "Acesso permitido apenas dentro do horario configurado";

/**
 * Bloqueia técnicos fora do horário configurado (ADMIN sempre passa).
 * Fail-closed: falha de infraestrutura bloqueia o acesso.
 */
export async function horarioAccessMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user || req.user.role === "ADMIN") {
    next();
    return;
  }

  try {
    const config = await prisma.configuracao.findFirst({
      select: { dataInicio: true, dataFim: true },
    });

    if (
      !config ||
      isWithinConfiguredHorario(config.dataInicio, config.dataFim)
    ) {
      next();
      return;
    }

    res.status(403).json({
      error: HORARIO_ACCESS_DENIED_MESSAGE,
      code: "FORBIDDEN",
    });
  } catch (error) {
    console.error("[horario-access] Falha ao verificar horário:", error);
    next(new ServiceUnavailableError());
  }
}
