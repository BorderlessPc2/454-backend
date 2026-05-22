import type { Request, Response, NextFunction } from "express";
import { isWithinConfiguredHorario } from "../lib/horario-utils.js";

export const HORARIO_LOGIN_DENIED_MESSAGE =
  "Login permitido apenas dentro do horario configurado";

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

  res.status(403).json({
    error: HORARIO_LOGIN_DENIED_MESSAGE,
  });
};
