import assert from "node:assert";
import { sanitizeRichTextHtml } from "../src/lib/sanitize-rich-text.js";

const input = "<p>Primeira linha<br/>Segunda linha</p>";
const output = sanitizeRichTextHtml(input);

assert.strictEqual(
  output,
  "<p>Primeira linha<br>Segunda linha</p>",
  "sanitizeRichTextHtml deve preservar <br> dentro de <p> e normalizar para <br>",
);

console.log("PASS: sanitizeRichTextHtml preserves and normalizes <br> tags");
