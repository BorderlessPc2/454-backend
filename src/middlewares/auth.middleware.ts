import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { extractAuthToken } from "../lib/extract-auth-token.js";
import { getJwtSecret } from "../lib/jwt-secret.js";

export type AuthUser = {
  id: number;
  username: string;
  role: string;
  clienteId: number | null;
  unidadeId: number | null;
};

export type AuthRequest = Request & {
  user?: AuthUser;
};

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const token = extractAuthToken(req);

  if (!token) {
    res.status(401).json({ error: "Token não fornecido", code: "UNAUTHORIZED" });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof decoded["id"] !== "number" ||
      typeof decoded["username"] !== "string" ||
      typeof decoded["role"] !== "string"
    ) {
      res.status(401).json({ error: "Token inválido", code: "UNAUTHORIZED" });
      return;
    }

    const user: AuthUser = {
      id: decoded["id"],
      username: decoded["username"],
      role: decoded["role"],
      clienteId:
        typeof decoded["clienteId"] === "number" ? decoded["clienteId"] : null,
      unidadeId:
        typeof decoded["unidadeId"] === "number" ? decoded["unidadeId"] : null,
    };

    (req as AuthRequest).user = user;

    next();
  } catch {
    res.status(401).json({ error: "Token inválido", code: "UNAUTHORIZED" });
  }
};
