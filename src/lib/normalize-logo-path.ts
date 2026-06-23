/** Normaliza separadores de caminho para formato URL-like. */
function toSlashPath(logoPath: string): string {
  return logoPath.replace(/\\/g, "/");
}

/** Extrai o nome do arquivo em `uploads/` a partir de caminhos relativos ou URLs públicas. */
export function extractUploadsFilename(logoPath: string): string | null {
  const normalized = toSlashPath(logoPath).trim();

  if (normalized.startsWith("/uploads/")) {
    return decodeURIComponent(normalized.slice("/uploads/".length));
  }

  if (normalized.startsWith("uploads/")) {
    return decodeURIComponent(normalized.slice("uploads/".length));
  }

  const match = normalized.match(/\/uploads\/([^?#]+)/);
  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }

  return null;
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

  const slashPath = toSlashPath(trimmed);
  const uploadsFilename = extractUploadsFilename(slashPath);
  if (uploadsFilename) {
    return `/uploads/${uploadsFilename}`;
  }

  if (/^https?:\/\//i.test(slashPath)) {
    return slashPath;
  }

  return slashPath.startsWith("/") ? slashPath : `/${slashPath}`;
}
