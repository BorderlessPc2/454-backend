/** Escapa texto para inserção segura em HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escapa valor de atributo HTML (ex.: src de img). */
export function escapeHtmlAttribute(text: string): string {
  return escapeHtml(text);
}
