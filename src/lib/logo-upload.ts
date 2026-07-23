import fs from "fs/promises";
import path from "path";

const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);

export type SystemLogoVariant = "light" | "dark";

export function getUploadsDir(): string {
  const configured = process.env["UPLOADS_DIR"]?.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.join(process.cwd(), configured);
  }
  return path.join(process.cwd(), "uploads");
}

export function resolveLogoExtension(
  originalName: string,
  mimetype: string,
): string {
  const fromName = path.extname(originalName).toLowerCase();
  if (ALLOWED_EXT.has(fromName)) {
    return fromName;
  }
  if (mimetype === "image/png") return ".png";
  if (mimetype === "image/jpeg") return ".jpg";
  if (mimetype === "image/webp") return ".webp";
  if (mimetype === "image/svg+xml") return ".svg";
  throw new Error("Formato de imagem não suportado. Use PNG, JPG, WEBP ou SVG.");
}

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export function buildLogoDataUrl(
  buffer: Buffer,
  mimetype: string,
  originalName: string,
): string {
  const ext = resolveLogoExtension(originalName, mimetype);
  const mime = MIME_BY_EXT[ext] ?? mimetype.split(";")[0]?.trim() ?? "image/png";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/** Prefixo do arquivo em disco — light e dark não podem compartilhar o mesmo path. */
export function systemLogoFilenamePrefix(variant: SystemLogoVariant): string {
  return variant === "dark" ? "system-logo-dark" : "system-logo";
}

export function isSystemLogoFilename(filename: string): boolean {
  return /^system-logo(-dark)?\.(png|jpe?g|webp|svg)$/i.test(filename);
}

export function systemLogoVariantFromFilename(
  filename: string,
): SystemLogoVariant | null {
  if (/^system-logo-dark\.(png|jpe?g|webp|svg)$/i.test(filename)) {
    return "dark";
  }
  if (/^system-logo\.(png|jpe?g|webp|svg)$/i.test(filename)) {
    return "light";
  }
  return null;
}

/**
 * Grava a logo do sistema em uploads/.
 * Light → `system-logo.{ext}` | Dark → `system-logo-dark.{ext}`
 * Cada variante só remove arquivos da própria variante.
 */
export async function writeSystemLogoFile(
  buffer: Buffer,
  originalName: string,
  mimetype: string,
  variant: SystemLogoVariant = "light",
): Promise<{ logoPath: string; filename: string }> {
  const ext = resolveLogoExtension(originalName, mimetype);
  const uploadsDir = getUploadsDir();
  await fs.mkdir(uploadsDir, { recursive: true });

  const prefix = systemLogoFilenamePrefix(variant);
  const entries = await fs.readdir(uploadsDir);
  await Promise.all(
    entries
      .filter((name) => {
        const lower = name.toLowerCase();
        // Só remove a própria variante (não apaga light ao salvar dark e vice-versa)
        if (variant === "dark") {
          return lower.startsWith("system-logo-dark.");
        }
        return (
          lower.startsWith("system-logo.") &&
          !lower.startsWith("system-logo-dark.")
        );
      })
      .map((name) => fs.unlink(path.join(uploadsDir, name)).catch(() => undefined)),
  );

  const filename = `${prefix}${ext}`;
  const dest = path.join(uploadsDir, filename);
  await fs.writeFile(dest, buffer);

  return {
    filename,
    logoPath: `/uploads/${filename}`,
  };
}
