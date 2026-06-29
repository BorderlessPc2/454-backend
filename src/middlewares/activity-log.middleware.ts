import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { parseActivityFromRequest } from "../lib/activity-path-parser.js";
import { systemActivityLogger } from "../lib/system-activity-logger.js";
import { resolveClientIp } from "../lib/resolve-client-ip.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Registra automaticamente ações de escrita (POST/PUT/PATCH/DELETE)
 * feitas por usuários autenticados.
 */
export function activityLogMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!MUTATING_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      return;
    }

    const user = req.user;
    if (!user) {
      return;
    }

    const path = req.baseUrl + req.path;
    const parsed = parseActivityFromRequest(
      req.method,
      path,
      req.params as Record<string, string>,
    );

    if (!parsed) {
      return;
    }

    void systemActivityLogger(prisma, {
      usuarioId: user.id,
      acao: parsed.acao,
      entidade: parsed.entidade,
      entidadeId: parsed.entidadeId,
      descricao: parsed.descricao,
      ipAddress: resolveClientIp(req),
      metadata: {
        method: req.method,
        path,
        role: user.role,
        username: user.username,
      },
    }).catch((error: unknown) => {
      console.error("[activity-log] Falha ao persistir log:", error);
    });
  });

  next();
}
