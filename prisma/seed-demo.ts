/**
 * Seed enxuto para testes locais (~3 registros por módulo).
 * Apaga dados de negócio e recria um cenário mínimo para exercitar todos os fluxos.
 *
 * Uso:
 *   npm run prisma:seed:demo
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import { applyDefaultSystemLogoIfMissing } from "../src/lib/default-system-logo.js";

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  throw new Error("DATABASE_URL não configurada");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const SENHA_PADRAO = "demo123";

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function utcDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
}

async function limparDados(): Promise<void> {
  console.log("Limpando dados existentes...");
  await prisma.systemActivityLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.relatorioChecklist.deleteMany();
  await prisma.relatorioHorario.deleteMany();
  await prisma.relatorioSetor.deleteMany();
  await prisma.relatorioTecnico.deleteMany();
  await prisma.relatorio.deleteMany();
  await prisma.clienteContato.deleteMany();
  await prisma.contrato.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.checklist.deleteMany();
  await prisma.setor.deleteMany();
  await prisma.ramoAtividade.deleteMany();
  await prisma.user.deleteMany();
}

async function main(): Promise<void> {
  console.log("=== Seed demo (dados de teste) ===\n");

  await limparDados();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);

  // --- Usuários (3) ---
  const admin = await prisma.user.create({
    data: {
      username: "admin",
      password: senhaHash,
      nome: "Administrador",
      email: "admin@demo.local",
      role: "ADMIN",
    },
  });

  const tecnico1 = await prisma.user.create({
    data: {
      username: "joao",
      password: senhaHash,
      nome: "João Silva",
      email: "joao@demo.local",
      role: "TECNICO",
      unidadeId: 1,
    },
  });

  const tecnico2 = await prisma.user.create({
    data: {
      username: "maria",
      password: senhaHash,
      nome: "Maria Santos",
      email: "maria@demo.local",
      role: "TECNICO",
      unidadeId: 2,
    },
  });

  console.log("Usuários: admin, joao, maria");

  // --- Configuração (1) — janela ampla para não bloquear login ---
  const configInicio = utcDateTime(2020, 1, 1, 0, 0);
  const configFim = utcDateTime(2030, 12, 31, 23, 59);

  await prisma.configuracao.create({
    data: {
      dataInicio: configInicio,
      dataFim: configFim,
      textoRodapeRelatorio:
        "<p>LINQ Informática — Relatório gerado em ambiente de demonstração.</p>",
    },
  });

  await applyDefaultSystemLogoIfMissing(prisma);

  console.log("Configuração: horário liberado + rodapé de PDF");

  // --- Ramos (3) ---
  const [ramoErp, ramoIndustria, ramoSaude] = await Promise.all([
    prisma.ramoAtividade.create({ data: { nome: "ERP" } }),
    prisma.ramoAtividade.create({ data: { nome: "Indústria" } }),
    prisma.ramoAtividade.create({ data: { nome: "Saúde" } }),
  ]);

  console.log("Ramos: ERP, Indústria, Saúde");

  // --- Setores (3) ---
  const [setorTi, setorFinanceiro, setorOperacoes] = await Promise.all([
    prisma.setor.create({
      data: { nome: "Informática", descricao: "TI e infraestrutura" },
    }),
    prisma.setor.create({
      data: { nome: "Financeiro", descricao: "Contas e faturamento" },
    }),
    prisma.setor.create({
      data: { nome: "Operações", descricao: "Produção e logística" },
    }),
  ]);

  console.log("Setores: Informática, Financeiro, Operações");

  // --- Checklists (3) com itens ---
  const checklistBackup = await prisma.checklist.create({
    data: {
      nome: "BACKUP - VBR",
      descricao: "Rotina de backup",
      indice: 0,
      itens: {
        create: [
          { texto: "Verificar job de backup noturno", ordem: 0 },
          { texto: "Validar restauração de teste", ordem: 1 },
        ],
      },
    },
  });

  const checklistAntivirus = await prisma.checklist.create({
    data: {
      nome: "ANTIVÍRUS - Serviços",
      descricao: "Antivírus corporativo",
      indice: 1,
      itens: {
        create: [
          { texto: "Conferir atualização de definições", ordem: 0 },
          { texto: "Revisar alertas críticos", ordem: 1 },
        ],
      },
    },
  });

  const checklistUpdates = await prisma.checklist.create({
    data: {
      nome: "Updates - Microsoft",
      descricao: "Patches Windows",
      indice: 2,
      itens: {
        create: [
          { texto: "Listar pendências do WSUS", ordem: 0 },
          { texto: "Aplicar updates aprovados", ordem: 1 },
        ],
      },
    },
  });

  console.log("Checklists: 3 com itens");

  // --- Clientes (3) — 2 na unidade 1, 1 na unidade 2 ---
  const clienteTech = await prisma.cliente.create({
    data: {
      unidadeId: 1,
      razaoSocial: "TechSolutions Sistemas LTDA",
      nomeFantasia: "TechSolutions",
      cnpj: "11.111.111/0001-11",
      endereco: "Av. Paulista, 1000",
      cidade: "São Paulo",
      estado: "SP",
      cep: "01310-100",
      telefone: "(11) 3000-1000",
      email: "contato@techsolutions.demo",
      ramoAtividadeId: ramoErp.id,
    },
  });

  const clienteMercado = await prisma.cliente.create({
    data: {
      unidadeId: 1,
      razaoSocial: "Mercado do Povo LTDA",
      nomeFantasia: "Mercado do Povo",
      cnpj: "22.222.222/0001-22",
      endereco: "Rua das Flores, 200",
      cidade: "Campinas",
      estado: "SP",
      cep: "13010-200",
      telefone: "(19) 3000-2000",
      email: "ti@mercadodopovo.demo",
      ramoAtividadeId: ramoIndustria.id,
    },
  });

  const clienteNorte = await prisma.cliente.create({
    data: {
      unidadeId: 2,
      razaoSocial: "Indústria Norte SA",
      nomeFantasia: "Indústria Norte",
      cnpj: "33.333.333/0001-33",
      endereco: "Rod. BR-101, km 45",
      cidade: "Recife",
      estado: "PE",
      cep: "50000-300",
      telefone: "(81) 3000-3000",
      email: "suporte@industrianorte.demo",
      ramoAtividadeId: ramoSaude.id,
    },
  });

  const [contatoTech, contatoMercado, contatoNorte] = await Promise.all([
    prisma.clienteContato.create({
      data: {
        clienteId: clienteTech.id,
        nome: "Carlos Mendes",
        cargo: "Gerente de TI",
        telefone: "(11) 98888-1111",
        email: "carlos@techsolutions.demo",
        principal: true,
      },
    }),
    prisma.clienteContato.create({
      data: {
        clienteId: clienteMercado.id,
        nome: "Ana Paula",
        cargo: "Coordenadora",
        telefone: "(19) 98888-2222",
        email: "ana@mercadodopovo.demo",
        principal: true,
      },
    }),
    prisma.clienteContato.create({
      data: {
        clienteId: clienteNorte.id,
        nome: "Roberto Lima",
        cargo: "Diretor",
        telefone: "(81) 98888-3333",
        email: "roberto@industrianorte.demo",
        principal: true,
      },
    }),
  ]);

  const inicioContrato = utcDate(2026, 1, 1);

  await Promise.all([
    prisma.contrato.create({
      data: {
        clienteId: clienteTech.id,
        numeroContrato: "CTR-2026-001",
        dataInicio: inicioContrato,
        dataFim: utcDate(2026, 12, 31),
        valorMensal: 4500,
        descricaoServicos: "Suporte mensal presencial e remoto",
        visitasMensaisEsperadas: 4,
      },
    }),
    prisma.contrato.create({
      data: {
        clienteId: clienteMercado.id,
        numeroContrato: "CTR-2026-002",
        dataInicio: inicioContrato,
        valorMensal: 2800,
        descricaoServicos: "Manutenção de infraestrutura",
        visitasMensaisEsperadas: 4,
      },
    }),
    prisma.contrato.create({
      data: {
        clienteId: clienteNorte.id,
        numeroContrato: "CTR-2026-003",
        dataInicio: inicioContrato,
        valorMensal: 6200,
        descricaoServicos: "Consultoria e suporte dedicado",
        visitasMensaisEsperadas: 3,
      },
    }),
  ]);

  console.log("Clientes: 3 (2 unid. 1, 1 unid. 2) com contato e contrato");

  // Datas de referência — mês corrente para KPIs / SLA
  const hoje = new Date();
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth() + 1;
  const dia = hoje.getUTCDate();

  const visita1 = utcDate(ano, mes, Math.max(1, dia - 10));
  const visita2 = utcDate(ano, mes, Math.max(1, dia - 5));
  const visitaAgendada = utcDate(ano, mes, Math.min(28, dia + 7));

  // --- Relatórios (3): FINALIZADO, FINALIZADO (SLA em risco), AGENDADO ---
  const relFinalizado = await prisma.relatorio.create({
    data: {
      clienteId: clienteTech.id,
      contatoId: contatoTech.id,
      criadoPorId: tecnico1.id,
      dataVisita: visita1,
      modalidadeServico: "local",
      status: "FINALIZADO",
      observacoes: "<p>Visita de rotina. Servidores e backup validados.</p>",
      impresso: false,
      tecnicos: {
        create: [{ nome: tecnico1.nome }],
      },
      setores: {
        create: [
          { setorId: setorTi.id, observacao: "Servidores OK" },
          { setorId: setorFinanceiro.id, observacao: "Sem pendências" },
        ],
      },
      horarios: {
        create: [
          {
            horaChegada: utcDateTime(ano, mes, visita1.getUTCDate(), 9, 0),
            horaSaida: utcDateTime(ano, mes, visita1.getUTCDate(), 12, 30),
          },
          {
            horaChegada: utcDateTime(ano, mes, visita1.getUTCDate(), 13, 30),
            horaSaida: utcDateTime(ano, mes, visita1.getUTCDate(), 17, 0),
          },
        ],
      },
      checklists: {
        create: [
          { checklistId: checklistBackup.id },
          { checklistId: checklistAntivirus.id },
        ],
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      relatorioId: relFinalizado.id,
      usuarioId: tecnico1.id,
      acao: "CREATE",
    },
  });

  // Mercado do Povo: 1 visita no mês (meta 4 → aparece em contratosSlaRisco)
  const relSlaRisco = await prisma.relatorio.create({
    data: {
      clienteId: clienteMercado.id,
      contatoId: contatoMercado.id,
      criadoPorId: tecnico1.id,
      dataVisita: visita2,
      modalidadeServico: "local",
      status: "FINALIZADO",
      observacoes: "Visita parcial — pendências no setor de operações.",
      tecnicos: {
        create: [{ nome: tecnico1.nome }, { nome: "Pedro Auxiliar" }],
      },
      setores: {
        create: [{ setorId: setorOperacoes.id, observacao: "Aguardando peça" }],
      },
      horarios: {
        create: {
          horaChegada: utcDateTime(ano, mes, visita2.getUTCDate(), 10, 0),
          horaSaida: utcDateTime(ano, mes, visita2.getUTCDate(), 14, 0),
        },
      },
      checklists: {
        create: [{ checklistId: checklistUpdates.id }],
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      relatorioId: relSlaRisco.id,
      usuarioId: tecnico1.id,
      acao: "CREATE",
    },
  });

  const relAgendado = await prisma.relatorio.create({
    data: {
      clienteId: clienteNorte.id,
      contatoId: contatoNorte.id,
      criadoPorId: tecnico2.id,
      dataVisita: visitaAgendada,
      status: "AGENDADO",
      tecnicos: {
        create: [{ nome: tecnico2.nome }],
      },
      horarios: {
        create: {
          horaChegada: utcDateTime(
            ano,
            mes,
            visitaAgendada.getUTCDate(),
            9,
            0,
          ),
          horaSaida: utcDateTime(
            ano,
            mes,
            visitaAgendada.getUTCDate(),
            10,
            0,
          ),
        },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      relatorioId: relAgendado.id,
      usuarioId: tecnico2.id,
      acao: "CREATE",
    },
  });

  console.log("Relatórios: 2 FINALIZADO + 1 AGENDADO (com horários, setores, checklists)");

  // --- Logs de atividade (3) — auditoria admin ---
  await prisma.systemActivityLog.createMany({
    data: [
      {
        usuarioId: admin.id,
        acao: "LOGIN",
        entidade: "AUTH",
        descricao: "Login de demonstração (seed)",
        ipAddress: "127.0.0.1",
      },
      {
        usuarioId: tecnico1.id,
        acao: "CREATE",
        entidade: "RELATORIO",
        entidadeId: relFinalizado.id,
        descricao: "Relatório criado via seed demo",
        ipAddress: "127.0.0.1",
      },
      {
        usuarioId: admin.id,
        acao: "UPDATE",
        entidade: "CONFIGURACAO",
        entidadeId: 1,
        descricao: "Configuração inicial do ambiente demo",
        ipAddress: "127.0.0.1",
      },
    ],
  });

  console.log("Activity logs: 3 registros de exemplo");

  console.log("\n=== Seed demo concluído ===\n");
  console.log("Credenciais (senha para todos: " + SENHA_PADRAO + "):");
  console.log("  ADMIN   → admin / " + SENHA_PADRAO);
  console.log("  TECNICO → joao  / " + SENHA_PADRAO + "  (unidade 1)");
  console.log("  TECNICO → maria / " + SENHA_PADRAO + "  (unidade 2)");
  console.log("\nFluxos cobertos:");
  console.log("  • Login admin e técnicos (horário liberado)");
  console.log("  • CRUD clientes, contatos, contratos (3 clientes)");
  console.log("  • Relatórios finalizados + agendamento + PDF");
  console.log("  • Calendário (visita agendada futura)");
  console.log("  • Dashboard KPIs e SLA em risco (Mercado do Povo)");
  console.log("  • Filtros por unidade (1 vs 2) e setor");
  console.log("  • Relatórios gerenciais (visitas no mês corrente)");
  console.log("  • Checklists com itens, setores, ramos");
  console.log("  • Configurações / rodapé PDF");
  console.log("  • Auditoria (activity-logs + audit-logs por relatório)");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
