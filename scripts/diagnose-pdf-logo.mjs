/**
 * Diagnóstico: compara fluxo sidebar (GET /configuracoes/pdf) vs PDF (loadPdfBranding).
 * Uso: node scripts/diagnose-pdf-logo.mjs
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { existsSync } from "fs";
import { join } from "path";
import { normalizeLogoStoragePath } from "../dist/lib/normalize-logo-path.js";
import { getUploadsDir } from "../dist/lib/logo-upload.js";
import { resolvePublicLogoUrl } from "../dist/lib/public-logo-url.js";
import {
  isValidLogoDataUrl,
  resolveLogoDataUrl,
  resolvePdfLogoDataUrl,
} from "../dist/lib/resolve-logo-data-url.js";

const prisma = new PrismaClient();

try {
  const config = await prisma.configuracao.findFirst({
    select: {
      id: true,
      logoUrl: true,
      logoDataUrl: true,
      textoRodapeRelatorio: true,
    },
  });

  console.log("=== DB configuracoes ===");
  console.log(JSON.stringify(
    {
      id: config?.id ?? null,
      logoUrl: config?.logoUrl ?? null,
      logoDataUrlPresent: Boolean(config?.logoDataUrl?.trim()),
      logoDataUrlLength: config?.logoDataUrl?.length ?? 0,
      logoDataUrlValid: isValidLogoDataUrl(config?.logoDataUrl),
    },
    null,
    2,
  ));

  const logoStoragePath = normalizeLogoStoragePath(config?.logoUrl);
  const sidebarLogoUrl = resolvePublicLogoUrl(config?.logoUrl);
  const uploadsDir = getUploadsDir();
  const localFile = logoStoragePath
    ? join(uploadsDir, logoStoragePath.replace(/^\/uploads\//, ""))
    : null;

  console.log("\n=== Sidebar (GET /configuracoes/pdf) ===");
  console.log({ sidebarLogoUrl, logoStoragePath, uploadsDir, localFile });

  if (localFile) {
    console.log({
      localFileExists: existsSync(localFile),
      localFileSize: existsSync(localFile)
        ? (await import("fs/promises")).then((fs) =>
            fs.stat(localFile).then((s) => s.size),
          )
        : 0,
    });
  }

  if (localFile && existsSync(localFile)) {
    const { stat } = await import("fs/promises");
    console.log({ localFileSize: (await stat(localFile)).size });
  } else if (localFile) {
    console.log({ localFileExists: false });
  }

  console.log("\n=== PDF resolve chain ===");
  const fromPath = await resolveLogoDataUrl(logoStoragePath);
  const fromPdfConfig = await resolvePdfLogoDataUrl({
    logoDataUrl: config?.logoDataUrl,
    logoStoragePath,
    logoUrl: config?.logoUrl,
  });

  console.log({
    resolveLogoDataUrl: fromPath
      ? { valid: true, length: fromPath.length }
      : null,
    resolvePdfLogoDataUrl: fromPdfConfig
      ? { valid: true, length: fromPdfConfig.length }
      : null,
  });

  if (sidebarLogoUrl && !fromPdfConfig) {
    console.log("\n=== Tentativa fetch sidebar URL ===");
    try {
      const res = await fetch(sidebarLogoUrl);
      console.log({
        fetchStatus: res.status,
        contentType: res.headers.get("content-type"),
        ok: res.ok,
      });
    } catch (error) {
      console.log({
        fetchError: error instanceof Error ? error.message : String(error),
      });
    }
  }
} finally {
  await prisma.$disconnect();
}
