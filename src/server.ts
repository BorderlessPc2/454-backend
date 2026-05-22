import "dotenv/config";
import app from "./app.js";
import { assertJwtConfiguredAtStartup } from "./lib/jwt-secret.js";
import { prisma } from "./lib/prisma.js";

/** Falha rápido em produção com JWT_SECRET inválido (antes do listen). */
assertJwtConfiguredAtStartup();

const port = Number(process.env["PORT"] ?? 3000);

process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED_REJECTION]", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[UNCAUGHT_EXCEPTION]", error);
});

const server = app.listen(port, () => {
  console.log(`API on http://localhost:${port}`);
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
