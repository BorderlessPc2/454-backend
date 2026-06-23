import type { Response, NextFunction } from "express";
import type { Request } from "express";

/**
 * Impede que segmentos como "calendario" ou "gerencial" caiam em rotas /:id.
 */
export function requireNumericIdParam(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const raw = req.params["id"];
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
    res.status(404).json({ error: "Rota não encontrada" });
    return;
  }
  next();
}
