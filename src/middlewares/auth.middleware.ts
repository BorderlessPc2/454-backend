import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
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
}

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: "Token não fornecido" });
    return;
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2) {
    res.status(401).json({ error: "Token mal formatado" });
    return;
  }

  const scheme = parts[0];
  const token = parts[1];

  if (!scheme || !token || !/^Bearer$/i.test(scheme)) {
    res.status(401).json({ error: "Token mal formatado" });
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
