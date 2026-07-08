# Sistema de Relatórios - Backend

Sistema completo de gerenciamento de relatórios técnicos com autenticação JWT e controle de acesso por roles.

## Estrutura do Projeto

```
src/
├── controllers/       # Controllers para cada recurso
├── services/         # Lógica de negócio
├── routes/           # Definição de rotas
├── middlewares/      # Auth, Role e Horário
├── types/            # DTOs e interfaces
├── docs/             # OpenAPI (openapi.yaml) + carregador
└── lib/              # Prisma client
```

## Tecnologias

- Node.js + TypeScript
- Express
- Prisma ORM
- PostgreSQL
- JWT Authentication
- Bcrypt
- OpenAPI 3 + Swagger UI (`swagger-ui-express`)

## Documentação da API (Swagger)

Com a API rodando (**ambiente diferente de `NODE_ENV=production`**, ou com **`EXPOSE_API_DOCS=1`** em produção):

- **UI:** [http://localhost:3000/api-docs](http://localhost:3000/api-docs) (ajuste a porta se `PORT` for outra)
- **JSON:** [http://localhost:3000/openapi.json](http://localhost:3000/openapi.json)

Em produção (`NODE_ENV=production`) as rotas do Swagger ficam **ocultas** por omissão; defina **`EXPOSE_API_DOCS=1`** no Render se precisar da UI em ambiente público (avaliando o risco de exposição).

Na interface, use **Authorize** e informe `Bearer <token>` obtido em `POST /auth/login`.

A especificação fonte está em `src/docs/openapi.yaml` (copiada para `dist/docs/` no `npm run build`).

## Operação em produção (Render / Postgres / regressão)

- **[docs/OPERACOES-E-PRODUCAO.md](./docs/OPERACOES-E-PRODUCAO.md)** — logs, **`GET /health`**, **`GET /health/db`**, **`npm run db:migrate-status`**, uploads/logo, **`JWT_EXPIRES_IN`**, Swagger em prod (**`EXPOSE_API_DOCS`**), **`OPS_REQUEST_LOG=1`**.
- **[docs/backup-e-dr.md](./docs/backup-e-dr.md)** — `pg_dump` e conceito de restauração.
- **[docs/REGRESSAO-E2E-CHECKLIST.md](./docs/REGRESSAO-E2E-CHECKLIST.md)** — checklist manual pós-deploy.

## Pré-requisitos

- Node.js 20+ (recomendado: 22 LTS)
- Docker Desktop (para subir o PostgreSQL local)

## Instalação

```bash
npm install
```

## Configuração

1. Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

No PowerShell (Windows):

```powershell
Copy-Item .env.example .env
```

2. Configure as variáveis no `.env`:

```env
DATABASE_URL="postgresql://linq:linqq608U@localhost:5432/polls?schema=public"
JWT_SECRET="sua-chave-secreta-aqui"
JWT_EXPIRES_IN="8h"
PORT=3000
SMTP_USER="seu-email@gmail.com"
SMTP_PASS="senha-de-app-do-gmail"
```

`SMTP_USER` / `SMTP_PASS` são necessários para `POST /relatorios/:id/enviar-email` (Gmail com [senha de app](https://support.google.com/accounts/answer/185833)).

3. Suba o banco PostgreSQL via Docker:

```bash
docker compose up -d
```

4. Execute as migrations:

```bash
npm run prisma:migrate
```

5. Gere o Prisma Client:

```bash
npm run prisma:generate
```

## Executar

### Desenvolvimento

```bash
npm run dev
```

### Produção

```bash
npm run build
npm start
```

## Roles

- **ADMIN**: Acesso total ao sistema
- **TECNICO**: Acesso limitado (CRUD clientes e relatórios)

## Rotas Principais

### Autenticação

- `POST /auth/login` - Login (retorna JWT)

### Usuários (ADMIN only)

- `POST /users` - Criar usuário
- `GET /users` - Listar usuários
- `GET /users/:id` - Buscar usuário
- `PUT /users/:id` - Atualizar usuário
- `DELETE /users/:id` - Deletar usuário

### Clientes (ADMIN e TECNICO)

- `POST /clientes` - Criar cliente
- `GET /clientes` - Listar clientes (filtros: nomeFantasia, cnpj, ramoAtividadeId)
- `GET /clientes/:id` - Buscar cliente
- `PUT /clientes/:id` - Atualizar cliente
- `DELETE /clientes/:id` - Deletar cliente
- `POST /clientes/:id/contatos` - Criar contato
- `PUT /clientes/:id/contatos/:contatoId` - Atualizar contato
- `DELETE /clientes/:id/contatos/:contatoId` - Deletar contato

### Relatórios (ADMIN e TECNICO)

- `POST /relatorios` - Criar relatório
- `GET /relatorios` - Listar relatórios (filtros: clienteId, dataInicio, dataFim, criadoPorId, impresso)
- `GET /relatorios/:id` - Buscar relatório
- `PUT /relatorios/:id` - Atualizar relatório
- `DELETE /relatorios/:id` - Deletar relatório
- `POST /relatorios/:id/enviar-email` - Gerar PDF e enviar por e-mail ao contato

### Checklists (ADMIN only)

- `POST /checklists` - Criar checklist
- `GET /checklists` - Listar checklists
- `GET /checklists/:id` - Buscar checklist
- `PUT /checklists/:id` - Atualizar checklist
- `DELETE /checklists/:id` - Deletar checklist

Exemplo de payload:

```json
{
  "nome": "Checklist de visita",
  "descricao": "Checklist padrao para visitas tecnicas"
}
```

### Setores (ADMIN only)

- `POST /setores` - Criar setor
- `GET /setores` - Listar setores
- `GET /setores/:id` - Buscar setor
- `PUT /setores/:id` - Atualizar setor
- `DELETE /setores/:id` - Deletar setor

### Ramos de Atividade (ADMIN only)

- `POST /ramos` - Criar ramo
- `GET /ramos` - Listar ramos
- `GET /ramos/:id` - Buscar ramo
- `PUT /ramos/:id` - Atualizar ramo
- `DELETE /ramos/:id` - Deletar ramo

### Configurações

- `GET /configuracoes` - Listar configurações (qualquer autenticado)
- `PUT /configuracoes` - Atualizar configuração (ADMIN only)

## Configurações do Sistema

Para configurar horário de login permitido:

```json
{
  "dataInicio": "2026-02-12T08:00:00.000Z",
  "dataFim": "2026-02-12T18:00:00.000Z"
}
```

## Segurança (resumo do backend)

| Item | Comportamento |
|------|----------------|
| **`JWT_SECRET`** | Produção (**`NODE_ENV=production`**): obrigatório, **≥32 caracteres**, não pode ser valor de exemplo. Dev: permite placeholder com **aviso** no log. Implementação: `src/lib/jwt-secret.ts`. |
| **Login brute force** | Rate limit aplicado apenas em **`POST /auth/login`** (`express-rate-limit`); ajustável com **`LOGIN_RATE_LIMIT_MAX`** / **`LOGIN_RATE_LIMIT_WINDOW_MINUTES`**. |
| **`trust proxy`** | Ativo quando `NODE_ENV=production` ou **`TRUST_PROXY=1`** (IP correto no Render para o rate limit). |
| **`helmet`** | Headers HTTP endurecidos; **CSP** desativada para compatibilidade com SPA/Swagger. |
| **`express.json`** | Limite **512 KB** ao corpo JSON. |

Encerramento gracioso: **`SIGTERM` / SIGINT`** desligam HTTP e fazem **`prisma.$disconnect()`** antes de sair (`src/server.ts`).

## Autenticação

Todas as rotas (exceto `POST /auth/login`, health checks e documentação Swagger quando exposta) exigem token JWT:

```
Authorization: Bearer <token>
```

## Exemplo de Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "senha123"}'
```

Resposta:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "nome": "Administrador",
    "role": "ADMIN"
  }
}
```

## Criar Primeiro Usuário Admin

Após rodar as migrations, você pode criar um usuário admin diretamente no banco ou via seed script.

## Scripts Úteis

- `npm run dev` - Servidor em modo watch
- `npm run build` - Build para produção
- `npm run prisma:generate` - Gerar Prisma Client
- `npm run prisma:migrate` - Executar migrations
- **`npm run db:migrate-status`** - Estado das migrations contra o Postgres corrente
- **`npm run verify-login`** — diagnóstico local de senha/hash (`-- usuario senha`; ver `scripts/verify-login-credentials.mjs`)
- `npx prisma studio` - Interface visual do banco

## Licença

ISC
