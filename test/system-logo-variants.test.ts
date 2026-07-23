import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { getUploadsDir, writeSystemLogoFile } from "../src/lib/logo-upload.js";

const uploadsDir = getUploadsDir();
await mkdir(uploadsDir, { recursive: true });

const lightPath = join(uploadsDir, "system-logo.png");
const darkPath = join(uploadsDir, "system-logo-dark.png");

await rm(lightPath, { force: true });
await rm(darkPath, { force: true });

const lightBytes = Buffer.from("light-logo-bytes");
const darkBytes = Buffer.from("dark-logo-bytes-xx");

const light = await writeSystemLogoFile(
  lightBytes,
  "logo.png",
  "image/png",
  "light",
);
assert.equal(light.logoPath, "/uploads/system-logo.png");
assert.equal(existsSync(lightPath), true);

const dark = await writeSystemLogoFile(
  darkBytes,
  "logo-dark.png",
  "image/png",
  "dark",
);
assert.equal(dark.logoPath, "/uploads/system-logo-dark.png");
assert.equal(existsSync(darkPath), true);

// Dark não pode apagar a light
assert.equal(await readFile(lightPath, "utf8"), "light-logo-bytes");
assert.equal(await readFile(darkPath, "utf8"), "dark-logo-bytes-xx");

// Light não pode apagar a dark
await writeSystemLogoFile(
  Buffer.from("light-v2"),
  "logo.png",
  "image/png",
  "light",
);
assert.equal(await readFile(lightPath, "utf8"), "light-v2");
assert.equal(await readFile(darkPath, "utf8"), "dark-logo-bytes-xx");

await rm(lightPath, { force: true });
await rm(darkPath, { force: true });

console.log("system-logo-variants.test.ts OK");
