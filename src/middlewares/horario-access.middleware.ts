import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { isWithinConfiguredHorario } from "../lib/horario-utils.js";

export const HORARIO_ACCESS_DENIED_MESSAGE =
  "Acesso permitido apenas dentro do horario configurado";

/**
 * Bloqueia técnicos fora do horário configurado (ADMIN sempre passa).
 * Complementa a checagem feita apenas no login.
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

    res.status(403).json({ error: HORARIO_ACCESS_DENIED_MESSAGE });
  } catch {
    next();
  }
}
