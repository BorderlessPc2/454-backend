import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { getJwtSecret } from "../lib/jwt-secret.js";
import { AUTH_COOKIE_NAME } from "../lib/auth-cookie.js";

export type AuthUser = {
  id: number;
  username: string;
  role: string;
  clienteId: number | null;
  unidadeId: number | null;
};

export type AuthRequest = Request & {
  user?: AuthUser;
}

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const cookies = (req as Request & { cookies?: Record<string, unknown> })
    .cookies;
  const tokenRaw = cookies?.[AUTH_COOKIE_NAME];
  const token = typeof tokenRaw === "string" ? tokenRaw : "";

  if (!token) {
    res.status(401).json({ error: "Token não fornecido" });
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
      res.status(401).json({ error: "Token inválido" });
      return;
    }

    const user: AuthUser = {
      id: decoded["id"],
      username: decoded["username"],
      role: decoded["role"],
      clienteId:
        typeof decoded["clienteId"] === "number" ? decoded["clienteId"] : null,
      unidadeId:
        typeof decoded["unidadeId"] === "number"
          ? decoded["unidadeId"]
          : typeof decoded["clienteId"] === "number"
            ? decoded["clienteId"]
            : null,
    };

    (req as AuthRequest).user = user;

    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
};
