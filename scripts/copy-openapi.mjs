import { copyFileSync, mkdirSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function copyFile(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

const openapiSrc = join(root, "src", "docs", "openapi.yaml");
const openapiDest = join(root, "dist", "docs", "openapi.yaml");
copyFile(openapiSrc, openapiDest);
console.log("[copy-assets] Copiado para dist/docs/openapi.yaml");

const templatesSrc = join(root, "src", "templates");
const templatesDest = join(root, "dist", "templates");
for (const file of readdirSync(templatesSrc)) {
  copyFile(join(templatesSrc, file), join(templatesDest, file));
  console.log(`[copy-assets] Copiado para dist/templates/${file}`);
}
