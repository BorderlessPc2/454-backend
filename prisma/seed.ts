import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import { applyDefaultSystemLogoIfMissing } from "../src/lib/default-system-logo.js";

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  throw new Error("DATABASE_URL nao configurada");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Limpar dados antigos (ordem importante por causa das foreign keys)
  console.log("Limpando dados antigos...");
  await prisma.relatorioChecklist.deleteMany();
  await prisma.relatorioHorario.deleteMany();
  await prisma.relatorioSetor.deleteMany();
  await prisma.relatorioTecnico.deleteMany();
  await prisma.relatorio.deleteMany();
  await prisma.clienteContato.deleteMany();
  await prisma.contrato.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.checklist.deleteMany();
  await prisma.setor.deleteMany();
  await prisma.ramoAtividade.deleteMany();
  console.log("Dados antigos removidos!");

  // Criar usuário admin
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: hashedPassword,
      nome: "Administrador",
      email: "admin@example.com",
      role: "ADMIN",
    },
  });

  console.log("Admin user created:", admin);

  // Criar usuário tecnico
  const hashedTecPassword = await bcrypt.hash("tecnico123", 10);
  const tecnico = await prisma.user.upsert({
    where: { username: "tecnico" },
    update: {},
    create: {
      username: "tecnico",
      password: hashedTecPassword,
      nome: "Tecnico",
      email: "tecnico@example.com",
      role: "TECNICO",
    },
  });

  console.log("Tecnico user created:", tecnico);

  // Criar configurações iniciais
  const inicio = new Date();
  inicio.setHours(8, 0, 0, 0);
  const fim = new Date();
  fim.setHours(18, 0, 0, 0);

  await prisma.configuracao.upsert({
    where: { id: 1 },
    update: { dataInicio: inicio, dataFim: fim },
    create: { id: 1, dataInicio: inicio, dataFim: fim },
  });

  await applyDefaultSystemLogoIfMissing(prisma);

  console.log("Configurações iniciais criadas");

  // Criar ramos de atividade
  const ramosNomes = [
    "Entretenimento",
    "ERP",
    "Cartório",
    "Transportes",
    "Escritório Contábil",
    "Indústria",
    "Clínica Médica",
    "Federação",
    "Distribuidora",
    "Indústria de Jóias",
    "Órgão Público",
    "Agronegócio",
    "Indústria Alimentícia",
  ];

  for (const nome of ramosNomes) {
    await prisma.ramoAtividade.create({ data: { nome } });
  }

  console.log(`${ramosNomes.length} Ramos de atividade criados`);

  // Criar setores
  const setoresNomes = [
    "Administração",
    "Agricultura",
    "Comercial",
    "Contabilidade",
    "CRAS",
    "Cultura",
    "Educação",
    "Engenharia",
    "Financeiro",
    "Informática",
    "Marketing",
    "Patrimônio",
    "Saúde",
    "Vendas",
  ];

  for (const nome of setoresNomes) {
    await prisma.setor.create({ data: { nome } });
  }

  console.log(`${setoresNomes.length} Setores criados`);

  // Criar checklists
  const checklistsNomes = [
    "ANTISPAM - Análise de Quarentena",
    "ANTISPAM - Revisão de Logs",
    "ANTIVÍRUS - Revisão de Logs",
    "ANTIVÍRUS - Validação de Serviços",
    "ANTIVÍRUS - Varredura Preventiva",
    "APACHE - Vencimento certificados SSL",
    "BACKUP - Exportações",
    "BACKUP - Exportações (Validação)",
    "BACKUP - VBR",
    "BACKUP - VBR - (Validação)",
    "E-MAIL - Revisão de Filas",
    "E-MAIL - Validação de Serviços",
    "Limpeza de Temporários",
    "Updates - Linux",
    "Updates - Microsoft",
    "VIRTUALIZAÇÃO - Snapshots (Validação)",
    "VIRTUALIZAÇÃO - Storage (Validação)",
  ];

  for (const nome of checklistsNomes) {
    await prisma.checklist.create({ data: { nome, ativo: true } });
  }

  console.log(`${checklistsNomes.length} Checklists criados`);

  // Buscar primeiro ramo para cliente
  const ramo = await prisma.ramoAtividade.findFirst();

  // Criar um cliente exemplo
  const cliente = await prisma.cliente.create({
    data: {
      unidadeId: 1,
      razaoSocial: "TechSolutions Sistemas LTDA",
      nomeFantasia: "TechSolutions",
      cnpj: "12.345.678/0001-90",
      inscricaoEstadual: "123.456.789.012",
      endereco: "Av. Paulista, 1000",
      cidade: "São Paulo",
      estado: "SP",
      cep: "01310-100",
      telefone: "(11) 3000-5000",
      email: "contato@techsolutions.com",
      ramoAtividadeId: ramo?.id || 1,
      ativo: true,
    },
  });

  console.log("Cliente criado:", cliente);

  await prisma.user.update({
    where: { id: admin.id },
    data: { clienteId: cliente.id, unidadeId: cliente.unidadeId },
  });

  await prisma.user.update({
    where: { id: tecnico.id },
    data: { clienteId: cliente.id, unidadeId: cliente.unidadeId },
  });

  // Criar um contato para o cliente
  const contato = await prisma.clienteContato.create({
    data: {
      clienteId: cliente.id,
      nome: "Maria Oliveira",
      cargo: "Gerente de TI",
      telefone: "(11) 98888-7777",
      email: "maria.oliveira@techsolutions.com",
      principal: true,
    },
  });

  console.log("Contato criado:", contato);

  // Criar relatório de exemplo
  const setores = await prisma.setor.findMany({ take: 3 });
  const checklists = await prisma.checklist.findMany({ take: 5 });

  const dataVisita = new Date("2026-02-18");
  const horaChegada = new Date("2026-02-18T09:00:00");
  const horaSaida = new Date("2026-02-18T17:30:00");

  const relatorio = await prisma.relatorio.create({
    data: {
      clienteId: cliente.id,
      contatoId: contato.id,
      criadoPorId: tecnico.id,
      dataVisita,
      observacoes:
        "Visita técnica de manutenção preventiva. Todos os sistemas operacionais.",
      impresso: false,
      tecnicos: {
        createMany: {
          data: [{ nome: "João Silva" }, { nome: "Pedro Santos" }],
        },
      },
      setores: {
        createMany: {
          data: setores.map((setor) => ({
            setorId: setor.id,
            observacao: `Setor ${setor.nome} verificado - OK`,
          })),
        },
      },
      horarios: {
        create: {
          horaChegada,
          horaSaida,
        },
      },
      checklists: {
        createMany: {
          data: checklists.map((checklist) => ({
            checklistId: checklist.id,
          })),
        },
      },
    },
  });

  console.log("Relatório criado:", relatorio);

  console.log("Seed complete!");
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
