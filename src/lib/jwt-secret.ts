/**
 * Validação e cache do segredo JWT.
 * Produção exige JWT_SECRET forte; desenvolvimento avisa mas aceita fallback explícito.
 */
const KNOWN_WEAK_SECRET = "your-secret-key-change-in-production";
const JWT_SECRET_MIN_LENGTH_PRODUCTION = 32;

let cachedJwtSecret: string | null = null;

export function getJwtSecret(): string {
  if (cachedJwtSecret !== null) {
    return cachedJwtSecret;
  }

  const raw = process.env["JWT_SECRET"];
  const value = typeof raw === "string" ? raw.trim() : "";
  const isProduction = process.env["NODE_ENV"] === "production";

  if (!value || value === KNOWN_WEAK_SECRET) {
    if (isProduction) {
      throw new Error(
        "[security] JWT_SECRET é obrigatório em NODE_ENV=production e não pode ser valor de exemplo",
      );
    }
    console.warn(
      "[security] JWT_SECRET ausente ou inválido — usando valor de exemplo APENAS em desenvolvimento",
    );
    cachedJwtSecret = KNOWN_WEAK_SECRET;
    return cachedJwtSecret;
  }

  if (isProduction && value.length < JWT_SECRET_MIN_LENGTH_PRODUCTION) {
    throw new Error(
      `[security] JWT_SECRET deve ter pelo menos ${JWT_SECRET_MIN_LENGTH_PRODUCTION} caracteres em produção`,
    );
  }

  cachedJwtSecret = value;
  return cachedJwtSecret;
}

/** Força avaliação no arranque (falhas em produção antes de aceitar tráfego). */
export function assertJwtConfiguredAtStartup(): void {
  getJwtSecret();
}
