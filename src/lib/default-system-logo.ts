import type { PrismaClient } from "@prisma/client";
import { buildLogoDataUrl, writeSystemLogoFile } from "./logo-upload.js";
import { isValidLogoDataUrl } from "./resolve-logo-data-url.js";

/** Logo SVG mínima usada em dev/seed quando nenhuma logo foi enviada pelo admin. */
export const DEFAULT_SYSTEM_LOGO_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60" role="img" aria-label="LINQ">
  <rect width="200" height="60" fill="#163a5c" rx="6"/>
  <text x="100" y="39" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#ffffff" text-anchor="middle">LINQ</text>
</svg>`;

/**
 * Grava `system-logo.svg` em uploads e persiste `logoUrl` + `logoDataUrl` na configuração
 * quando ainda não há logo válida (ex.: seed local sem upload manual).
 */
export async function applyDefaultSystemLogoIfMissing(
  prisma: PrismaClient,
): Promise<boolean> {
  const config = await prisma.configuracao.findFirst({
    select: { id: true, logoDataUrl: true },
    orderBy: { id: "asc" },
  });

  if (!config || isValidLogoDataUrl(config.logoDataUrl)) {
    return false;
  }

  const buffer = Buffer.from(DEFAULT_SYSTEM_LOGO_SVG, "utf8");
  const { logoPath } = await writeSystemLogoFile(
    buffer,
    "system-logo.svg",
    "image/svg+xml",
  );
  const logoDataUrl = buildLogoDataUrl(
    buffer,
    "image/svg+xml",
    "system-logo.svg",
  );

  await prisma.configuracao.update({
    where: { id: config.id },
    data: { logoUrl: logoPath, logoDataUrl },
  });

  return true;
}
