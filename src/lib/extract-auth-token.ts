import type { Request } from "express";
import { AUTH_COOKIE_NAME } from "./auth-cookie.js";

/**
 * Extrai o JWT do cookie httpOnly (SPA) ou do header Authorization (Swagger/CLI).
 */
export function extractAuthToken(req: Request): string {
  const cookies = (req as Request & { cookies?: Record<string, unknown> })
    .cookies;
  const cookieToken = cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken;
  }

  const authHeader = req.headers?.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.slice("Bearer ".length).trim();
    if (bearer.length > 0) {
      return bearer;
    }
  }

  return "";
}
