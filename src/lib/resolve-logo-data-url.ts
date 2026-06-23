import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { extname, join, sep } from "path";
import { getUploadsDir } from "./logo-upload.js";
import {
  extractUploadsFilename,
  normalizeLogoStoragePath,
} from "./normalize-logo-path.js";
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
  logoUrl?: string | null | undefined;
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
  if (buffer.length < 8) {
    return null;
  }

  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isWebp =
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";
  const isSvg = buffer
    .toString("utf8", 0, Math.min(buffer.length, 256))
    .includes("<svg");

  if (!isPng && !isJpeg && !isWebp && !isSvg) {
    return null;
  }

  const ext = extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] ?? "image/png";
}

async function readFileAsDataUrl(filePath: string): Promise<string | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const buffer = await readFile(filePath);
    const mime = detectImageMime(buffer, filePath);
    if (!mime) {
      console.warn("[logo] Formato de imagem não reconhecido:", filePath);
      return null;
    }

    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.warn(
      "[logo] Falha ao ler arquivo:",
      filePath,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function collectLocalFileCandidates(normalized: string): string[] {
  const candidates = new Set<string>();
  const uploadsFilename = extractUploadsFilename(normalized);

  if (uploadsFilename) {
    candidates.add(join(getUploadsDir(), uploadsFilename));
  }

  if (existsSync(normalized)) {
    candidates.add(normalized);
  }

  const nativePath = normalized.replace(/\//g, sep);
  if (nativePath !== normalized) {
    candidates.add(nativePath);
  }

  return [...candidates];
}

async function fetchRemoteAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ??
      "image/png";

    if (!contentType.startsWith("image/")) {
      return null;
    }

    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Converte logo da plataforma em data URL para embutir no HTML do Puppeteer. */
export async function resolveLogoDataUrl(
  logoPath: string | null | undefined,
): Promise<string | null> {
  const normalized = normalizeLogoStoragePath(logoPath);
  if (!normalized) {
    return null;
  }

  if (isValidLogoDataUrl(normalized)) {
    return normalized.trim();
  }

  for (const filePath of collectLocalFileCandidates(normalized)) {
    const local = await readFileAsDataUrl(filePath);
    if (local) {
      return local;
    }
  }

  const candidateUrls = new Set<string>();
  if (/^https?:\/\//i.test(normalized)) {
    candidateUrls.add(normalized);
  }

  const publicUrl = resolvePublicLogoUrl(normalized);
  if (publicUrl) {
    candidateUrls.add(publicUrl);
  }

  for (const url of candidateUrls) {
    const remote = await fetchRemoteAsDataUrl(url);
    if (isValidLogoDataUrl(remote)) {
      return remote.trim();
    }
  }

  return null;
}

/**
 * Resolve a logo para PDF priorizando data URL válida em memória/DB,
 * com fallback para leitura local e fetch remoto.
 */
export async function resolvePdfLogoDataUrl(
  config: PdfLogoConfig,
): Promise<string | null> {
  if (isValidLogoDataUrl(config.logoDataUrl)) {
    return config.logoDataUrl.trim();
  }

  const storagePath =
    normalizeLogoStoragePath(config.logoStoragePath) ??
    normalizeLogoStoragePath(config.logoUrl);

  if (!storagePath) {
    return null;
  }

  const resolved = await resolveLogoDataUrl(storagePath);
  return isValidLogoDataUrl(resolved) ? resolved.trim() : null;
}
