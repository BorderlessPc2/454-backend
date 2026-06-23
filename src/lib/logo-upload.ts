import fs from "fs/promises";
import path from "path";

const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);

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

export async function writeSystemLogoFile(
  buffer: Buffer,
  originalName: string,
  mimetype: string,
): Promise<{ logoPath: string; filename: string }> {
  const ext = resolveLogoExtension(originalName, mimetype);
  const uploadsDir = getUploadsDir();
  await fs.mkdir(uploadsDir, { recursive: true });

  const entries = await fs.readdir(uploadsDir);
  await Promise.all(
    entries
      .filter((name) => name.startsWith("system-logo."))
      .map((name) => fs.unlink(path.join(uploadsDir, name)).catch(() => undefined)),
  );

  const filename = `system-logo${ext}`;
  const dest = path.join(uploadsDir, filename);
  await fs.writeFile(dest, buffer);

  return {
    filename,
    logoPath: `/uploads/${filename}`,
  };
}
