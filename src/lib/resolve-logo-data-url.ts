import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { basename, extname, isAbsolute, join, sep } from "path";
import { getUploadsDir } from "./logo-upload.js";
import {
  extractUploadsFilename,
  normalizeLogoStoragePath,
} from "./normalize-logo-path.js";
import { pdfLogoDebug, pdfLogoWarn } from "./pdf-logo-debug.js";
import { resolvePublicLogoUrl } from "./public-logo-url.js";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export type PdfLogoConfig = {
  logoDataUrl?: string | null | undefined;
  logoStoragePath?: string | null | undefined;
  /** Valor bruto salvo no banco (`logo_url`). Mesma fonte usada por GET /configuracoes/pdf. */
  logoUrl?: string | null | undefined;
};

export type ResolvedPdfLogo = {
  logoDataUrl: string | null;
  source:
    | "db-logoDataUrl"
    | "disk"
    | "sidebar-public-url"
    | "remote-url"
    | "fallback";
};

/** Valida se o valor é uma data URL de imagem utilizável no HTML do PDF. */
export function isValidLogoDataUrl(
  value: string | null | undefined,
): value is string {
  if (value == null) {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("data:image/")) {
    return false;
  }

  const base64Marker = ";base64,";
  const markerIndex = trimmed.indexOf(base64Marker);
  if (markerIndex === -1) {
    return false;
  }

  return trimmed.slice(markerIndex + base64Marker.length).length > 0;
}

function detectImageMime(buffer: Buffer, filePath: string): string | null {
  const ext = extname(filePath).toLowerCase();
  if (ext && MIME_BY_EXT[ext]) {
    if (ext === ".svg") {
      return MIME_BY_EXT[ext];
    }
  }

  if (buffer.length < 8) {
    return ext && MIME_BY_EXT[ext] ? MIME_BY_EXT[ext] : null;
  }

  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isWebp =
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";
  const isSvg = buffer
    .toString("utf8", 0, Math.min(buffer.length, 4096))
    .includes("<svg");

  if (isPng) return MIME_BY_EXT[".png"] ?? "image/png";
  if (isJpeg) return MIME_BY_EXT[".jpg"] ?? "image/jpeg";
  if (isWebp) return MIME_BY_EXT[".webp"] ?? "image/webp";
  if (isSvg) return MIME_BY_EXT[".svg"] ?? "image/svg+xml";

  return ext && MIME_BY_EXT[ext] ? MIME_BY_EXT[ext] : null;
}

async function readFileAsDataUrl(filePath: string): Promise<string | null> {
  const exists = existsSync(filePath);
  pdfLogoDebug("readFileAsDataUrl", { filePath, exists });

  if (!exists) {
    return null;
  }

  try {
    const buffer = await readFile(filePath);
    const mime = detectImageMime(buffer, filePath);
    if (!mime) {
      pdfLogoWarn("Formato de imagem não reconhecido", { filePath });
      return null;
    }

    pdfLogoDebug("readFileAsDataUrl ok", {
      filePath,
      bytes: buffer.length,
      mime,
    });

    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch (error) {
    pdfLogoWarn("Falha ao ler arquivo de logo", {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function collectLocalFileCandidates(
  normalizedStoragePath: string,
  rawLogoUrl: string | null | undefined,
): string[] {
  const candidates = new Set<string>();
  const uploadsDir = getUploadsDir();

  const pathsToInspect = new Set<string>();
  if (normalizedStoragePath) {
    pathsToInspect.add(normalizedStoragePath);
  }
  if (rawLogoUrl?.trim()) {
    pathsToInspect.add(rawLogoUrl.trim());
  }

  for (const value of pathsToInspect) {
    const uploadsFilename = extractUploadsFilename(value);
    if (uploadsFilename) {
      candidates.add(join(uploadsDir, uploadsFilename));
    }

    if (isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)) {
      candidates.add(value);
      candidates.add(value.replace(/\//g, sep));
    }

    const normalized = value.replace(/\\/g, "/");
    if (normalized.startsWith("/uploads/")) {
      candidates.add(join(process.cwd(), normalized.slice(1)));
    }

    if (!normalized.includes("/") && !normalized.includes("\\")) {
      candidates.add(join(uploadsDir, basename(normalized)));
    }
  }

  pdfLogoDebug("collectLocalFileCandidates", {
    uploadsDir,
    candidates: [...candidates],
  });

  return [...candidates];
}

async function fetchRemoteAsDataUrl(url: string): Promise<string | null> {
  pdfLogoDebug("fetchRemoteAsDataUrl", { url });

  try {
    const response = await fetch(url);
    if (!response.ok) {
      pdfLogoDebug("fetchRemoteAsDataUrl failed status", {
        url,
        status: response.status,
      });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ??
      "image/png";

    if (!contentType.startsWith("image/")) {
      pdfLogoWarn("fetch retornou content-type não-imagem", { url, contentType });
      return null;
    }

    pdfLogoDebug("fetchRemoteAsDataUrl ok", {
      url,
      bytes: buffer.length,
      contentType,
    });

    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch (error) {
    pdfLogoDebug("fetchRemoteAsDataUrl error", {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Converte caminho/caminho normalizado da logo em data URL (disco → fetch). */
export async function resolveLogoDataUrl(
  logoPath: string | null | undefined,
  rawLogoUrl?: string | null,
): Promise<string | null> {
  const normalized = normalizeLogoStoragePath(logoPath);
  pdfLogoDebug("resolveLogoDataUrl input", {
    logoPath,
    rawLogoUrl,
    normalized,
  });

  if (!normalized && !rawLogoUrl?.trim()) {
    return null;
  }

  if (normalized && isValidLogoDataUrl(normalized)) {
    return normalized.trim();
  }

  const localCandidates = collectLocalFileCandidates(
    normalized ?? "",
    rawLogoUrl,
  );
  for (const filePath of localCandidates) {
    const local = await readFileAsDataUrl(filePath);
    if (isValidLogoDataUrl(local)) {
      return local.trim();
    }
  }

  const remoteCandidates = new Set<string>();
  const sidebarPublicUrl = resolvePublicLogoUrl(rawLogoUrl ?? logoPath);
  if (sidebarPublicUrl) {
    remoteCandidates.add(sidebarPublicUrl);
  }

  if (normalized && /^https?:\/\//i.test(normalized)) {
    remoteCandidates.add(normalized);
  }

  const normalizedPublicUrl = normalized
    ? resolvePublicLogoUrl(normalized)
    : null;
  if (normalizedPublicUrl) {
    remoteCandidates.add(normalizedPublicUrl);
  }

  for (const url of remoteCandidates) {
    const remote = await fetchRemoteAsDataUrl(url);
    if (isValidLogoDataUrl(remote)) {
      return remote.trim();
    }
  }

  return null;
}

/**
 * Resolve logo para PDF alinhada ao GET /configuracoes/pdf (sidebar).
 * Ordem: logoDataUrl do banco → disco → URL pública da sidebar → fallback.
 */
export async function resolveLogoForPdfFromConfig(
  config: PdfLogoConfig,
): Promise<ResolvedPdfLogo> {
  pdfLogoDebug("resolveLogoForPdfFromConfig", {
    logoUrl: config.logoUrl ?? null,
    logoStoragePath: config.logoStoragePath ?? null,
    logoDataUrlPresent: Boolean(config.logoDataUrl?.trim()),
    logoDataUrlLength: config.logoDataUrl?.length ?? 0,
    logoDataUrlValid: isValidLogoDataUrl(config.logoDataUrl),
  });

  if (isValidLogoDataUrl(config.logoDataUrl)) {
    return {
      logoDataUrl: config.logoDataUrl.trim(),
      source: "db-logoDataUrl",
    };
  }

  const storagePath =
    normalizeLogoStoragePath(config.logoStoragePath) ??
    normalizeLogoStoragePath(config.logoUrl);

  const fromDisk = await resolveLogoDataUrl(storagePath, config.logoUrl);
  if (isValidLogoDataUrl(fromDisk)) {
    return { logoDataUrl: fromDisk.trim(), source: "disk" };
  }

  const sidebarPublicUrl = resolvePublicLogoUrl(config.logoUrl);
  if (sidebarPublicUrl) {
    const fromSidebarUrl = await fetchRemoteAsDataUrl(sidebarPublicUrl);
    if (isValidLogoDataUrl(fromSidebarUrl)) {
      return {
        logoDataUrl: fromSidebarUrl.trim(),
        source: "sidebar-public-url",
      };
    }
  }

  if (config.logoUrl && /^https?:\/\//i.test(config.logoUrl.trim())) {
    const fromRemote = await fetchRemoteAsDataUrl(config.logoUrl.trim());
    if (isValidLogoDataUrl(fromRemote)) {
      return { logoDataUrl: fromRemote.trim(), source: "remote-url" };
    }
  }

  pdfLogoWarn('Usando fallback "Linq" — logo não resolvida', {
    logoUrl: config.logoUrl ?? null,
    logoStoragePath: storagePath,
    sidebarPublicUrl: sidebarPublicUrl ?? null,
    uploadsDir: getUploadsDir(),
  });

  return { logoDataUrl: null, source: "fallback" };
}

/** @deprecated Prefer resolveLogoForPdfFromConfig */
export async function resolvePdfLogoDataUrl(
  config: PdfLogoConfig,
): Promise<string | null> {
  const resolved = await resolveLogoForPdfFromConfig(config);
  return resolved.logoDataUrl;
}
