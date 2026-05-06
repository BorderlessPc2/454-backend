/**
 * Seed mínimo para produção: só roda se não existir nenhum usuário.
 * Não apaga dados. Não cria configuracao de horário (login não fica preso em janela).
 *
 * Uso (na sua máquina, NÃO commite a URL):
 *   DATABASE_URL="postgresql://..." npm run prisma:seed:production
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  console.error("Defina DATABASE_URL (URL externa do Postgres no Render → Connect).");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const count = await prisma.user.count();
  if (count > 0) {
    console.log(`Já existem ${count} usuário(s). Nenhuma alteração feita.`);
    return;
  }

  console.log("Nenhum usuário encontrado. Criando admin e técnico iniciais...");

  const adminPass = await bcrypt.hash("admin123", 10);
  const tecPass = await bcrypt.hash("tecnico123", 10);

  await prisma.user.createMany({
    data: [
      {
        username: "admin",
        password: adminPass,
        nome: "Administrador",
        email: "admin@example.com",
        role: "ADMIN",
      },
      {
        username: "tecnico",
        password: tecPass,
        nome: "Tecnico",
        email: "tecnico@example.com",
        role: "TECNICO",
      },
    ],
  });

  console.log("OK. Primeiro login Netlify:");
  console.log("  admin / admin123   ou   tecnico / tecnico123");
  console.log("Altere as senhas assim que possível (usuários → edição / fluxo do sistema).");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
