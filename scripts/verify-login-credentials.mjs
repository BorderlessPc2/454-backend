#!/usr/bin/env node
/**
 * Diagnóstico: credenciais vs hash bcrypt no Postgres (DATABASE_URL igual à produção).
 * Uso: npm run verify-login -- <usuario_ou_email> <senha>
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

function resolveDatabaseUrl(raw) {
  try {
    const url = new URL(raw);
    const h = url.hostname;
    const shortRenderPg = /^dpg-[a-z0-9]+-a$/i.test(h);
    if (shortRenderPg) {
      url.hostname = `${h}.oregon-postgres.render.com`;
      console.warn(
        "[verify-login] Host interno Render expandido (Oregon) + ssl",
      );
    }
    if (!url.searchParams.has("sslmode")) {
      if (shortRenderPg || /\.render\.com$/i.test(url.hostname)) {
        url.searchParams.set("sslmode", "require");
      }
    }
    return url.toString();
  } catch {
    return raw;
  }
}

const ident = process.argv[2]?.trim();
const pwd = process.argv[3];

if (!ident || pwd == null || String(pwd).trim() === "") {
  console.error("Uso: npm run verify-login -- <usuario_ou_email> <senha>");
  process.exit(1);
}

const rawUrl = process.env["DATABASE_URL"]?.trim();
if (!rawUrl) {
  console.error("Defina DATABASE_URL no .env.");
  process.exit(1);
}

const prisma = new PrismaClient({
  datasourceUrl: resolveDatabaseUrl(rawUrl),
});

try {
  await prisma.$connect();
  console.log("[verify-login] OK conexão\n");

  const total = await prisma.user.count();
  console.log(`[verify-login] users: ${total}\n`);

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: ident }, { username: ident }] },
    select: {
      id: true,
      username: true,
      email: true,
      ativo: true,
      password: true,
    },
  });

  if (!user) {
    console.log(`Sem usuário com email OU username = "${ident}"`);
    process.exit(2);
  }

  console.log(
    `id=${user.id} username=${JSON.stringify(user.username)} email=${JSON.stringify(user.email)} ativo=${user.ativo}`,
  );
  if (!user.ativo) {
    console.log("\nativo=false ⇒ login responde como credenciais inválidas.");
    process.exit(3);
  }

  const match = await bcrypt.compare(String(pwd), user.password);
  console.log(`\nbcrypt confere? ${match ? "SIM" : "NAO"}`);
  process.exit(match ? 0 : 4);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
