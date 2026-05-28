import type { CookieOptions } from "express";

export const AUTH_COOKIE_NAME = "auth_token";

/**
 * Opções do cookie de sessão.
 * Em produção (front e API em domínios diferentes) é obrigatório SameSite=None + Secure.
 */
export function getAuthCookieOptions(): CookieOptions {
  const isProduction = process.env["NODE_ENV"] === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: 8 * 60 * 60 * 1000, // 8h — alinhado ao JWT_EXPIRES_IN padrão
  };
}
