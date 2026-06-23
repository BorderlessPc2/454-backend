import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { getUploadsDir } from "../src/lib/logo-upload.js";
import {
  isValidLogoDataUrl,
  resolveLogoDataUrl,
  resolvePdfLogoDataUrl,
} from "../src/lib/resolve-logo-data-url.js";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

assert.equal(isValidLogoDataUrl(null), false);
assert.equal(isValidLogoDataUrl(""), false);
assert.equal(isValidLogoDataUrl("data:text/plain;base64,YQ=="), false);
assert.equal(
  isValidLogoDataUrl("data:image/png;base64,iVBORw0KGgo="),
  true,
);

const uploadsDir = getUploadsDir();
await mkdir(uploadsDir, { recursive: true });
const logoFilename = "test-logo-resolve.png";
const logoPath = join(uploadsDir, logoFilename);
await writeFile(logoPath, tinyPng);

try {
  const fromRelative = await resolveLogoDataUrl("/uploads/test-logo-resolve.png");
  assert.ok(isValidLogoDataUrl(fromRelative));
  assert.match(fromRelative!, /^data:image\/png;base64,/);

  const fromUploadsPrefix = await resolveLogoDataUrl("uploads/test-logo-resolve.png");
  assert.ok(isValidLogoDataUrl(fromUploadsPrefix));

  const fromAbsolute = await resolveLogoDataUrl(logoPath);
  assert.ok(isValidLogoDataUrl(fromAbsolute));

  const fromPdfConfig = await resolvePdfLogoDataUrl({
    logoStoragePath: "/uploads/test-logo-resolve.png",
    logoDataUrl: null,
  });
  assert.ok(isValidLogoDataUrl(fromPdfConfig));

  const prefersValidDbValue = await resolvePdfLogoDataUrl({
    logoStoragePath: "/uploads/missing.png",
    logoDataUrl: "data:image/png;base64,iVBORw0KGgo=",
  });
  assert.equal(prefersValidDbValue, "data:image/png;base64,iVBORw0KGgo=");
} finally {
  await rm(logoPath, { force: true });
}

console.log("resolve-logo-data-url.test.ts OK");
