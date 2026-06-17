import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { extname, join } from "path";
import { getUploadsDir } from "./logo-upload.js";
import { resolvePublicLogoUrl } from "./public-logo-url.js";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function extractUploadsFilename(logoPath: string): string | null {
  if (logoPath.startsWith("/uploads/")) {
    return logoPath.slice("/uploads/".length);
  }

  const match = logoPath.match(/\/uploads\/([^?#]+)/);
  return match?.[1] ?? null;
}

async function readLocalUploadAsDataUrl(filename: string): Promise<string | null> {
  const filePath = join(getUploadsDir(), filename);
  if (!existsSync(filePath)) {
    return null;
  }

  const buffer = await readFile(filePath);
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
  if (!logoPath?.trim()) {
    return null;
  }

  const normalized = logoPath.trim();
  const uploadsFilename = extractUploadsFilename(normalized);

  if (uploadsFilename) {
    const local = await readLocalUploadAsDataUrl(uploadsFilename);
    if (local) {
      return local;
    }
  }

  if (/^https?:\/\//i.test(normalized)) {
    const remote = await fetchRemoteAsDataUrl(normalized);
    if (remote) {
      return remote;
    }
  }

  const publicUrl = resolvePublicLogoUrl(normalized);
  if (publicUrl) {
    const remote = await fetchRemoteAsDataUrl(publicUrl);
    if (remote) {
      return remote;
    }
  }

  return null;
}
