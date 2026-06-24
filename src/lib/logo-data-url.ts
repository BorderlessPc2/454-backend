const BASE64_MARKER = ";base64,";

export type ParsedLogoDataUrl = {
  buffer: Buffer;
  mime: string;
};

/** Converte data URL de imagem em buffer + mime type. */
export function parseLogoDataUrl(
  dataUrl: string,
): ParsedLogoDataUrl | null {
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith("data:image/")) {
    return null;
  }

  const markerIndex = trimmed.indexOf(BASE64_MARKER);
  if (markerIndex === -1) {
    return null;
  }

  const mime = trimmed.slice("data:".length, markerIndex);
  const base64 = trimmed.slice(markerIndex + BASE64_MARKER.length);
  if (!mime || !base64) {
    return null;
  }

  try {
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0) {
      return null;
    }
    return { buffer, mime };
  } catch {
    return null;
  }
}
