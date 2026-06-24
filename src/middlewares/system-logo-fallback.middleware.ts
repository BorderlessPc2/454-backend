import type { NextFunction, Request, Response } from "express";
import { parseLogoDataUrl } from "../lib/logo-data-url.js";
import { prisma } from "../lib/prisma.js";
import { isValidLogoDataUrl } from "../lib/resolve-logo-data-url.js";

const SYSTEM_LOGO_PATTERN = /^system-logo\.(png|jpe?g|webp|svg)$/i;

function extractRequestedFilename(req: Request): string | null {
  const rawPath = req.path.split("?")[0] ?? "";
  const basename = rawPath.replace(/^\/+/, "").split("/").pop();
  return basename?.trim() ? basename : null;
}

/**
 * Fallback após `express.static` em `/uploads`: serve a logo do banco quando
 * o arquivo local não existe (containers efêmeros em produção).
 */
export async function systemLogoFallbackMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    next();
    return;
  }

  const filename = extractRequestedFilename(req);
  if (!filename || !SYSTEM_LOGO_PATTERN.test(filename)) {
    res.status(404).end();
    return;
  }

  try {
    const config = await prisma.configuracao.findFirst({
      select: { logoDataUrl: true },
    });

    if (!isValidLogoDataUrl(config?.logoDataUrl)) {
      res.status(404).end();
      return;
    }

    const parsed = parseLogoDataUrl(config.logoDataUrl);
    if (!parsed) {
      res.status(404).end();
      return;
    }

    res.setHeader("Content-Type", parsed.mime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=300");

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    res.send(parsed.buffer);
  } catch (error) {
    console.warn(
      "[system-logo-fallback]",
      error instanceof Error ? error.message : error,
    );
    res.status(404).end();
  }
}
