import assert from "node:assert/strict";
import { parseLogoDataUrl } from "../src/lib/logo-data-url.js";
import { restoreSystemLogoFromDatabase } from "../src/lib/restore-system-logo.js";
import { getUploadsDir } from "../src/lib/logo-upload.js";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const tinyPngDataUrl = `data:image/png;base64,${tinyPngBase64}`;

const parsed = parseLogoDataUrl(tinyPngDataUrl);
assert.ok(parsed);
assert.equal(parsed.mime, "image/png");
assert.equal(parsed.buffer.length, 70);

assert.equal(parseLogoDataUrl("data:text/plain;base64,YQ=="), null);
assert.equal(parseLogoDataUrl("data:image/png;base64,"), null);

const mockPrisma = {
  configuracao: {
    findFirst: async () => ({
      logoUrl: "/uploads/system-logo.png",
      logoDataUrl: tinyPngDataUrl,
    }),
  },
};

const uploadsDir = getUploadsDir();
const restoredPath = join(uploadsDir, "system-logo.png");

if (existsSync(restoredPath)) {
  await rm(restoredPath, { force: true });
}

const result = await restoreSystemLogoFromDatabase(
  mockPrisma as Parameters<typeof restoreSystemLogoFromDatabase>[0],
);
assert.equal(result.restored, true);
assert.equal(result.filename, "system-logo.png");
assert.equal(existsSync(restoredPath), true);

const restoredBytes = await readFile(restoredPath);
assert.equal(restoredBytes.length, 70);

const skipped = await restoreSystemLogoFromDatabase(
  mockPrisma as Parameters<typeof restoreSystemLogoFromDatabase>[0],
);
assert.equal(skipped.restored, false);

await rm(restoredPath, { force: true });

console.log("logo-data-url.test.ts OK");
