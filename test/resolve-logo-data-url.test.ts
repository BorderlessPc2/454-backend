import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { getUploadsDir } from "../src/lib/logo-upload.js";
import { resolvePublicLogoUrl } from "../src/lib/public-logo-url.js";
import {
  isValidLogoDataUrl,
  resolveLogoDataUrl,
  resolveLogoForPdfFromConfig,
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
  const storagePath = "/uploads/test-logo-resolve.png";
  const rawLogoUrl = storagePath;

  const fromRelative = await resolveLogoDataUrl(storagePath, rawLogoUrl);
  assert.ok(isValidLogoDataUrl(fromRelative));

  const sidebarUrl = resolvePublicLogoUrl(rawLogoUrl);
  assert.ok(sidebarUrl);

  const fromPdfConfig = await resolveLogoForPdfFromConfig({
    logoStoragePath: storagePath,
    logoUrl: rawLogoUrl,
    logoDataUrl: null,
  });
  assert.ok(isValidLogoDataUrl(fromPdfConfig.logoDataUrl));
  assert.notEqual(fromPdfConfig.source, "fallback");

  const prefersValidDbValue = await resolveLogoForPdfFromConfig({
    logoStoragePath: "/uploads/missing.png",
    logoUrl: "/uploads/missing.png",
    logoDataUrl: "data:image/png;base64,iVBORw0KGgo=",
  });
  assert.equal(
    prefersValidDbValue.logoDataUrl,
    "data:image/png;base64,iVBORw0KGgo=",
  );
  assert.equal(prefersValidDbValue.source, "db-logoDataUrl");

  const fromAbsoluteDbUrl = await resolveLogoForPdfFromConfig({
    logoStoragePath: storagePath,
    logoUrl: sidebarUrl,
    logoDataUrl: null,
  });
  assert.ok(isValidLogoDataUrl(fromAbsoluteDbUrl.logoDataUrl));
} finally {
  await rm(logoPath, { force: true });
}

console.log("resolve-logo-data-url.test.ts OK");
