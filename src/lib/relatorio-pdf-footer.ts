import { sanitizeRichTextHtml } from "./sanitize-rich-text.js";

export type RelatorioPdfFooterConfig = {
  lines: string[];
  websiteTitle: string;
  websiteSubtitle: string;
};

const DEFAULT_FOOTER_LINES = [
  "LINQ INFORMÁTICA",
  "Rua Geraldo Pereira, 338 - Sala 704",
  "Alto da Bronze, Estrela/RS - CEP: 95.880-000",
  "Suporte: 51 3720-4462",
] as const;

/** Converte texto do rodapé (texto puro ou HTML simples) em linhas para o PDF. */
export function rodapeTextoToLines(raw: string): string[] {
  const sanitized = sanitizeRichTextHtml(raw) ?? "";
  const text = sanitized
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\r\n/g, "\n");

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function mapConfiguracoesToPdfFooter(
  textoRodapeRelatorio: string | null | undefined,
): RelatorioPdfFooterConfig {
  const raw = textoRodapeRelatorio?.trim() ?? "";
  const lines =
    raw.length > 0 ? rodapeTextoToLines(raw) : [...DEFAULT_FOOTER_LINES];

  return {
    lines,
    websiteTitle: "linqbr",
    websiteSubtitle: "www.linq.com.br",
  };
}
