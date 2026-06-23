const ENABLED = process.env["PDF_LOGO_DEBUG"] === "1";

export function pdfLogoDebug(message: string, data?: Record<string, unknown>): void {
  if (!ENABLED) {
    return;
  }
  console.log(`[pdf-logo:debug] ${message}`, data ?? "");
}

export function pdfLogoWarn(message: string, data?: Record<string, unknown>): void {
  console.warn(`[pdf-logo] ${message}`, data ?? "");
}
