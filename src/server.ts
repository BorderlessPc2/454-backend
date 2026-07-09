import "dotenv/config";
import app from "./app.js";
import { assertJwtConfiguredAtStartup } from "./lib/jwt-secret.js";
import { prisma } from "./lib/prisma.js";
import { applyDefaultSystemLogoIfMissing } from "./lib/default-system-logo.js";
import { restoreSystemLogoFromDatabase } from "./lib/restore-system-logo.js";
import { getUploadsDir } from "./lib/logo-upload.js";

/** Falha rápido em produção com JWT_SECRET inválido (antes do listen). */
assertJwtConfiguredAtStartup();

const port = Number(process.env["PORT"] ?? 3000);

process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED_REJECTION]", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[UNCAUGHT_EXCEPTION]", error);
});

await restoreSystemLogoFromDatabase(prisma);

if (process.env["NODE_ENV"] !== "production") {
  const appliedDefaultLogo = await applyDefaultSystemLogoIfMissing(prisma);
  if (appliedDefaultLogo) {
    console.log(
      "[default-system-logo] Logo padrão LINQ configurada para desenvolvimento local",
    );
  }
}

const server = app.listen(port, () => {
  console.log(`API on http://localhost:${port}`);
  console.log(`[uploads] Diretório: ${getUploadsDir()}`);
});

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`[shutdown] ${signal} — encerrando…`);
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  }).catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}

process.once("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});
process.once("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});
