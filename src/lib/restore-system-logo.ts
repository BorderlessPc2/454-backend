import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { parseLogoDataUrl } from "./logo-data-url.js";
import { getUploadsDir } from "./logo-upload.js";
import { extractUploadsFilename } from "./normalize-logo-path.js";
import { isValidLogoDataUrl } from "./resolve-logo-data-url.js";

const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

function resolveTargetFilename(
  logoUrl: string | null,
  mime: string,
): string {
  const fromUrl = logoUrl ? extractUploadsFilename(logoUrl) : null;
  if (fromUrl?.toLowerCase().startsWith("system-logo.")) {
    return fromUrl;
  }

  const ext = MIME_TO_EXT[mime] ?? ".png";
  return `system-logo${ext}`;
}

/**
 * Recria o arquivo em disco a partir de `logo_data_url` quando o container
 * perdeu `uploads/` (ex.: redeploy no Render sem volume persistente).
 */
export async function restoreSystemLogoFromDatabase(
  prisma: PrismaClient,
): Promise<{ restored: boolean; filename?: string }> {
  try {
    const config = await prisma.configuracao.findFirst({
      select: { logoUrl: true, logoDataUrl: true },
    });

    if (!config || !isValidLogoDataUrl(config.logoDataUrl)) {
      return { restored: false };
    }

    const parsed = parseLogoDataUrl(config.logoDataUrl);
    if (!parsed) {
      return { restored: false };
    }

    const filename = resolveTargetFilename(config.logoUrl, parsed.mime);
    const uploadsDir = getUploadsDir();
    const filePath = join(uploadsDir, filename);

    if (existsSync(filePath)) {
      return { restored: false };
    }

    await mkdir(uploadsDir, { recursive: true });
    await writeFile(filePath, parsed.buffer);

    console.log(
      `[restore-system-logo] Restaurado ${filename} a partir do banco (${parsed.buffer.length} bytes)`,
    );
    return { restored: true, filename };
  } catch (error) {
    console.warn(
      "[restore-system-logo] Falha ao restaurar logo:",
      error instanceof Error ? error.message : error,
    );
    return { restored: false };
  }
}
