import sanitizeHtml from "sanitize-html";

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "blockquote",
    "a",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    p: ["style"],
    h1: ["style"],
    h2: ["style"],
    h3: ["style"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  disallowedTagsMode: "discard",
};

const MAX_OBSERVACOES_LENGTH = 50_000;

/** Sanitiza HTML rico (TipTap) antes de persistir ou retornar. */
export function sanitizeRichTextHtml(raw: string | null | undefined): string | null {
  if (raw == null) {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > MAX_OBSERVACOES_LENGTH) {
    throw new Error(
      `Conteúdo excede o limite de ${MAX_OBSERVACOES_LENGTH} caracteres.`,
    );
  }

  const sanitized = sanitizeHtml(trimmed, RICH_TEXT_OPTIONS)
    .replace(/<br\s*\/?>/gi, "<br>")
    .trim();
  const textOnly = sanitized.replace(/<[^>]*>/g, "").trim();

  return textOnly ? sanitized : null;
}
