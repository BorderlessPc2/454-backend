/** Extrai o nome do arquivo em `uploads/` a partir de caminhos relativos ou URLs públicas. */
export function extractUploadsFilename(logoPath: string): string | null {
  if (logoPath.startsWith("/uploads/")) {
    return logoPath.slice("/uploads/".length);
  }

  const match = logoPath.match(/\/uploads\/([^?#]+)/);
  return match?.[1] ?? null;
}

/**
 * Normaliza o valor salvo em `logoUrl` para leitura local ou fetch remoto.
 * URLs públicas da API viram `/uploads/...`; URLs externas permanecem absolutas.
 */
export function normalizeLogoStoragePath(
  logoPath: string | null | undefined,
): string | null {
  if (logoPath == null) {
    return null;
  }

  const trimmed = logoPath.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("data:")) {
    return trimmed;
  }

  const uploadsFilename = extractUploadsFilename(trimmed);
  if (uploadsFilename) {
    return `/uploads/${uploadsFilename}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
