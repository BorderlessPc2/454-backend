# Prompt — Frontend: remover campo Unidade no cadastro de usuário

Cole este prompt no agente/chat do repositório **frontend**.

---

## Contexto

O backend **já foi atualizado**: ao criar/editar usuário (`POST /users`, `PUT /users/:id`), o campo `unidadeId` **não é mais obrigatório**.

Regra nova:

| Situação | Comportamento |
|----------|----------------|
| Usuário **com** `clienteId` | Backend deriva `unidadeId` automaticamente a partir do cliente |
| Usuário **sem** `clienteId` | `clienteId` e `unidadeId` ficam `null` — permitido para ADMIN e TECNICO |
| Enviar `unidadeId` no body | Opcional/legado — **não usar no formulário** |

Mensagens antigas que **não existem mais**:
- `"Técnico deve estar vinculado a um cliente ou a uma unidade"`

Referência backend: `src/services/auth.service.ts`, `CreateUserDTO` / `UpdateUserDTO` em `src/types/dtos.ts`, OpenAPI `CreateUserRequest` / `UpdateUserRequest`.

---

## Pedido

Ajustar a tela de usuários (modal **Novo Usuário** / **Editar Usuário**) para refletir a API.

### 1. Remover o campo Unidade do formulário

- Remover o select **"Unidade (obrigatório se não houver cliente)"**
- Remover do state do form qualquer `unidadeId`
- Remover imports/hooks só usados para esse select (ex.: `useUnidades` na página de usuários)
- Manter o select **"Cliente Associado (opcional)"** com opção **Nenhum**

### 2. Remover validação no front

Apagar qualquer check do tipo:

```ts
if (form.role === "TECNICO" && form.clienteId == null && form.unidadeId == null) {
  toast.error("Técnico deve estar vinculado a um cliente ou a uma unidade.");
  return;
}
```

Não bloquear create/update por falta de cliente ou unidade.

### 3. Payload de create / update

**Create (`POST /users`):**

```ts
{
  username: string;
  password: string;
  nome: string;
  email: string;
  role: "ADMIN" | "TECNICO";
  clienteId?: number; // só enviar se houver cliente selecionado
  // NÃO enviar unidadeId
}
```

**Update (`PUT /users/:id`):**

```ts
{
  nome?: string;
  email?: string;
  role?: "ADMIN" | "TECNICO";
  clienteId?: number | null; // null = remove vínculo com cliente
  ativo?: boolean;
  // NÃO enviar unidadeId
}
```

### 4. Tipos TypeScript

Atualizar `CreateUserPayload` / tipos de update para **não exigir** `unidadeId`:

```ts
interface CreateUserPayload {
  username: string;
  password: string;
  nome: string;
  email: string;
  role: "ADMIN" | "TECNICO";
  clienteId?: number;
}

interface UpdateUsuarioData {
  nome?: string;
  email?: string;
  role?: "ADMIN" | "TECNICO";
  clienteId?: number | null;
  ativo?: boolean;
}
```

No service (`createUsuario` / `updateUsuario`), não incluir `unidadeId` no body.

### 5. Escopo dos arquivos (esperado)

- Página/modal de usuários (ex.: `UsuariosPage.tsx`)
- Service de usuários (ex.: `usuarios-service.ts`)
- Tipos (ex.: `types.ts` — `CreateUserPayload`)

**Não alterar** fluxos de **cliente** / **dashboard** / **relatórios gerenciais** que ainda usam `unidadeId` corretamente (ex.: ADMIN criando cliente ainda precisa de `unidadeId`).

---

## Checklist

- [ ] Campo Unidade sumiu do modal Novo/Editar Usuário
- [ ] Dá para criar TECNICO sem cliente
- [ ] Dá para criar TECNICO/ADMIN com cliente opcional
- [ ] Payload de create/update **não** envia `unidadeId`
- [ ] Sem toast/validação pedindo unidade
- [ ] Editar usuário e escolher "Nenhum" em cliente remove o vínculo (`clienteId: null`)
- [ ] Hooks/imports de unidades órfãos removidos da página de usuários

---

## Observação

Técnico **sem** `unidadeId` no JWT pode receber **403** em rotas escopadas por unidade (clientes/relatórios). Isso é esperado: o vínculo de organização passa a existir só quando o usuário tiver cliente (e, com isso, unidade derivada) ou for ADMIN.
