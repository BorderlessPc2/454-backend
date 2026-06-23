import assert from "node:assert/strict";
import {
  extractUploadsFilename,
  normalizeLogoStoragePath,
} from "../src/lib/normalize-logo-path.js";

assert.equal(
  extractUploadsFilename("/uploads/system-logo.png"),
  "system-logo.png",
);
assert.equal(
  extractUploadsFilename("uploads/system-logo.png"),
  "system-logo.png",
);
assert.equal(
  extractUploadsFilename("http://localhost:3000/uploads/system-logo.webp"),
  "system-logo.webp",
);
assert.equal(
  extractUploadsFilename("D:\\app\\uploads\\system-logo.jpg"),
  "system-logo.jpg",
);

assert.equal(
  normalizeLogoStoragePath("/uploads/system-logo.png"),
  "/uploads/system-logo.png",
);
assert.equal(
  normalizeLogoStoragePath("uploads/system-logo.png"),
  "/uploads/system-logo.png",
);
assert.equal(
  normalizeLogoStoragePath("http://api.example.com/uploads/system-logo.png"),
  "/uploads/system-logo.png",
);
assert.equal(
  normalizeLogoStoragePath("https://cdn.example.com/logo.png"),
  "https://cdn.example.com/logo.png",
);
assert.equal(normalizeLogoStoragePath(null), null);
assert.equal(normalizeLogoStoragePath(""), null);

console.log("normalize-logo-path.test.ts OK");
