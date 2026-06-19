import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { extname, join } from "path";
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

async function readLocalUploadAsDataUrl(filename: string): Promise<string | null> {
  const filePath = join(getUploadsDir(), filename);
  if (!existsSync(filePath)) {
    return null;
  }

  const buffer = await readFile(filePath);
  if (buffer.length < 8) {
    console.warn(
      "[logo] Arquivo muito pequeno ou corrompido:",
      filePath,
      `(${buffer.length} bytes)`,
    );
    return null;
  }

  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isWebp =
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";
  const isSvg =
    buffer.toString("utf8", 0, Math.min(buffer.length, 256)).includes("<svg");

  if (!isPng && !isJpeg && !isWebp && !isSvg) {
    console.warn("[logo] Formato de imagem não reconhecido:", filePath);
    return null;
  }

  const ext = extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "image/png";
  return `data:${mime};base64,${buffer.toString("base64")}`;
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

  if (normalized.startsWith("data:")) {
    return normalized;
  }

  const uploadsFilename = extractUploadsFilename(normalized);
  if (uploadsFilename) {
    const local = await readLocalUploadAsDataUrl(uploadsFilename);
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
    if (remote) {
      return remote;
    }
  }

  return null;
}
