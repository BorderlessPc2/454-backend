# Prompt — Frontend: `unidadeId` obrigatório ao criar cliente (ADMIN)

Cole este prompt no agente/chat do repositório **frontend**.

---

## Contexto

Ao criar um cliente via `POST /clientes`, o backend retorna **400** com:

```json
{ "error": "unidadeId é obrigatório para criar cliente" }
```

Isso ocorre quando o usuário logado é **ADMIN**. O sistema é **multi-unidade**: todo `Cliente` pertence a uma organização (`unidade_id` no banco). Não existe tabela `Unidade` — é um **número inteiro** que agrupa clientes, relatórios e técnicos.

### Regra no backend

| Role do usuário | Como o `unidadeId` é resolvido na criação |
|-----------------|--------------------------------------------|
| **TECNICO** | Automático — vem do JWT (`user.unidadeId`). O front **não precisa** enviar `unidadeId`. |
| **ADMIN** | O JWT traz `user.unidadeId: null` (admin vê todas as unidades). O front **deve** enviar `unidadeId` no body do `POST /clientes`. |

Lógica em `cliente.service.ts`:

```ts
resolvedUnidade = scopedUnidadeId ?? body.unidadeId ?? null
// se null → erro "unidadeId é obrigatório para criar cliente"
```

Referência backend: `src/services/cliente.service.ts`, `src/lib/scoped-unidade.ts`, `CreateClienteDTO` em `src/types/dtos.ts`.

---

## Pedido

Corrigir o fluxo de **criação de cliente** para respeitar o escopo por unidade.

### 1. Tipos / contrato da API

Garantir que o payload de criação inclua `unidadeId` opcional no tipo TypeScript:

```ts
interface CreateClientePayload {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual?: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  telefone?: string;
  email?: string;
  ramoAtividadeId: number;
  /** Obrigatório no request quando user.role === "ADMIN" */
  unidadeId?: number;
  contato: { nome: string; cargo?: string; telefone?: string; email?: string };
  contrato: {
    numeroContrato: string;
    dataInicio: string;
    dataFim: string;
    valorMensal: number;
    descricaoServicos: string;
    condicoes?: string;
  };
}
```

### 2. Montar o payload conforme o usuário logado

No submit do formulário (ex.: `auth-context`, service de clientes, página de novo cliente):

```ts
function buildCreateClientePayload(form: FormValues, user: AuthUser): CreateClientePayload {
  const base = { /* campos do formulário */ };

  if (user.role === "TECNICO") {
    // Backend ignora/sobrescreve com a unidade do token — não enviar ou enviar é opcional
    return base;
  }

  // ADMIN: unidadeId é obrigatório
  const unidadeId = form.unidadeId ?? user.unidadeId;
  if (unidadeId == null || !Number.isInteger(unidadeId) || unidadeId < 1) {
    throw new Error("Selecione a unidade do cliente");
  }

  return { ...base, unidadeId };
}
```

### 3. UI para ADMIN

Quando `user.role === "ADMIN"`, exibir campo **Unidade** no formulário de novo cliente:

- **Select** com as unidades disponíveis.
- Não existe `GET /unidades` no backend hoje. Opções viáveis:
  - **Curto prazo (dev):** lista fixa `[{ id: 1, label: "Unidade 1" }]` — seed local usa `unidadeId: 1`.
  - **Melhor:** derivar opções de `GET /clientes` — cada cliente retornado tem `unidadeId`; fazer `distinct` e montar o select.
  - **Futuro:** endpoint dedicado de unidades (ainda não existe).

Validar no front **antes** do POST: se ADMIN e `unidadeId` vazio → mensagem amigável (“Selecione a unidade”), sem depender só do erro 400 do backend.

### 4. Tratamento de erro da API

Se ainda vier 400 com `error` contendo `unidadeId`:

- Exibir a mensagem do backend no toast/alert.
- Destacar o campo Unidade no formulário.

### 5. O que **não** fazer

- Não assumir que `user.unidadeId` existe para ADMIN (é `null`).
- Não hardcodar `unidadeId: 1` em produção sem UI — só aceitável como fallback temporário em dev.
- Não bloquear TECNICO: para ele o create deve continuar funcionando **sem** campo de unidade.

---

## Exemplo de request (ADMIN)

```http
POST http://localhost:3000/clientes
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "razaoSocial": "Empresa Exemplo LTDA",
  "nomeFantasia": "Empresa Exemplo",
  "cnpj": "12.345.678/0001-99",
  "endereco": "Rua A, 100",
  "cidade": "São Paulo",
  "estado": "SP",
  "cep": "01310-100",
  "ramoAtividadeId": 1,
  "unidadeId": 1,
  "contato": {
    "nome": "João Silva",
    "email": "joao@exemplo.com",
    "principal": true
  },
  "contrato": {
    "numeroContrato": "CTR-2026-001",
    "dataInicio": "2026-01-01",
    "dataFim": "2026-12-31",
    "valorMensal": 1500,
    "descricaoServicos": "Suporte mensal"
  }
}
```

## Resposta de login (referência)

`POST /auth/login` retorna:

```json
{
  "token": "...",
  "user": {
    "id": 6,
    "username": "admin",
    "nome": "Administrador",
    "role": "ADMIN",
    "clienteId": null,
    "unidadeId": null
  }
}
```

Para técnico, `unidadeId` vem preenchido (ex.: `1`).

## Teste local

| Usuário | Senha | Comportamento esperado no create cliente |
|---------|-------|------------------------------------------|
| `admin` | `demo123` | Precisa escolher/enviar `unidadeId` |
| `tecnico` | `tecnico123` | Create funciona sem campo unidade |

---

## Critérios de aceite

- [ ] ADMIN consegue criar cliente sem erro `unidadeId é obrigatório`.
- [ ] Formulário de ADMIN exibe seletor de unidade (ou validação clara antes do submit).
- [ ] Payload `POST /clientes` inclui `unidadeId` numérico quando `role === "ADMIN"`.
- [ ] TECNICO continua criando cliente normalmente (unidade inferida do token).
- [ ] Tipos TypeScript do payload e do `AuthUser` refletem `unidadeId: number | null`.
- [ ] Erro 400 do backend é mapeado para feedback visual no campo Unidade.

## Arquivos prováveis no front (ajustar conforme o repo)

- `auth-context.tsx` — garantir que `user.unidadeId` e `user.role` persistem após login.
- Service/hook de clientes — montar body do `POST /clientes`.
- Página/modal de **Novo Cliente** — campo Unidade condicional para ADMIN.
- Tipos em `types/` ou `api/` — `CreateClientePayload`, `AuthUser`.
