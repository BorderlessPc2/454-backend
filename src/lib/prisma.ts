import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../../.env") });

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
	throw new Error("DATABASE_URL nao configurada");
}

/**
 * Cliente Prisma padrão (pool pg nativo).
 * No Render, o driver `@prisma/adapter-pg` costuma ser mais sensível a SSL/host;
 * aqui evitamos o adapter para estabilidade em Docker/Node.
 */
export const prisma = new PrismaClient({
	datasourceUrl: databaseUrl,
});
