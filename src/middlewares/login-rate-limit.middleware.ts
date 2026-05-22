import rateLimit from "express-rate-limit";

const windowMinutes = Number(
  process.env["LOGIN_RATE_LIMIT_WINDOW_MINUTES"] ?? "15",
);
const maxAttempts = Number(process.env["LOGIN_RATE_LIMIT_MAX"] ?? "40");

/** Limita brute force contra POST /auth/login (por IP, com trust proxy atrás no Render). */
export const loginRateLimiter = rateLimit({
  windowMs: Math.max(1, Number.isFinite(windowMinutes) ? windowMinutes : 15) * 60 * 1000,
  limit: Math.max(5, Number.isFinite(maxAttempts) ? maxAttempts : 40),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Muitas tentativas de login. Aguarde e tente novamente.",
  },
});
