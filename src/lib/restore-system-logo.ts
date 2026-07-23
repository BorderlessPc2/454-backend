import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { parseLogoDataUrl } from "./logo-data-url.js";
import {
  getUploadsDir,
  systemLogoFilenamePrefix,
  type SystemLogoVariant,
} from "./logo-upload.js";
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
  variant: SystemLogoVariant,
): string {
  const fromUrl = logoUrl ? extractUploadsFilename(logoUrl) : null;
  const expectedPrefix = systemLogoFilenamePrefix(variant);

  if (fromUrl) {
    const lower = fromUrl.toLowerCase();
    if (variant === "dark" && lower.startsWith("system-logo-dark.")) {
      return fromUrl;
    }
    if (
      variant === "light" &&
      lower.startsWith("system-logo.") &&
      !lower.startsWith("system-logo-dark.")
    ) {
      return fromUrl;
    }
  }

  const ext = MIME_TO_EXT[mime] ?? ".png";
  return `${expectedPrefix}${ext}`;
}

async function restoreOneLogo(opts: {
  logoUrl: string | null;
  logoDataUrl: string | null | undefined;
  variant: SystemLogoVariant;
}): Promise<{ restored: boolean; filename?: string }> {
  if (!isValidLogoDataUrl(opts.logoDataUrl)) {
    return { restored: false };
  }

  const parsed = parseLogoDataUrl(opts.logoDataUrl);
  if (!parsed) {
    return { restored: false };
  }

  const filename = resolveTargetFilename(opts.logoUrl, parsed.mime, opts.variant);
  const uploadsDir = getUploadsDir();
  const filePath = join(uploadsDir, filename);

  if (existsSync(filePath)) {
    return { restored: false, filename };
  }

  await mkdir(uploadsDir, { recursive: true });
  await writeFile(filePath, parsed.buffer);

  console.log(
    `[restore-system-logo] Restaurado ${filename} (${opts.variant}) a partir do banco (${parsed.buffer.length} bytes)`,
  );
  return { restored: true, filename };
}

/**
 * Recria arquivos em disco a partir de `logo_data_url` / `logo_dark_data_url`
 * quando o container perdeu `uploads/` (ex.: redeploy sem volume persistente).
 * Também corrige `logo_dark_url` legado que apontava para o mesmo path da logo clara.
 */
export async function restoreSystemLogoFromDatabase(
  prisma: PrismaClient,
): Promise<{ restored: boolean; filename?: string; darkRestored?: boolean; darkFilename?: string }> {
  try {
    const config = await prisma.configuracao.findFirst({
      select: {
        id: true,
        logoUrl: true,
        logoDataUrl: true,
        logoDarkUrl: true,
        logoDarkDataUrl: true,
      },
    });

    if (!config) {
      return { restored: false };
    }

    const light = await restoreOneLogo({
      logoUrl: config.logoUrl,
      logoDataUrl: config.logoDataUrl,
      variant: "light",
    });

    const dark = await restoreOneLogo({
      logoUrl: config.logoDarkUrl,
      logoDataUrl: config.logoDarkDataUrl,
      variant: "dark",
    });

    // Corrige path legado: light e dark compartilhavam `/uploads/system-logo.*`
    if (isValidLogoDataUrl(config.logoDarkDataUrl) && dark.filename) {
      const darkFilenameLower = extractUploadsFilename(config.logoDarkUrl ?? "")
        ?.toLowerCase();
      const isLegacySharedPath =
        !darkFilenameLower ||
        (darkFilenameLower.startsWith("system-logo.") &&
          !darkFilenameLower.startsWith("system-logo-dark."));

      if (isLegacySharedPath) {
        const correctedPath = `/uploads/${dark.filename}`;
        if (config.logoDarkUrl !== correctedPath) {
          await prisma.configuracao.update({
            where: { id: config.id },
            data: { logoDarkUrl: correctedPath },
          });
          console.log(
            `[restore-system-logo] logo_dark_url corrigido para ${correctedPath}`,
          );
        }
      }
    }

    return {
      restored: light.restored,
      ...(light.filename ? { filename: light.filename } : {}),
      darkRestored: dark.restored,
      ...(dark.filename ? { darkFilename: dark.filename } : {}),
    };
  } catch (error) {
    console.warn(
      "[restore-system-logo] Falha ao restaurar logo:",
      error instanceof Error ? error.message : error,
    );
    return { restored: false };
  }
}
