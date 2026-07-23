# Prompt — Frontend: remover Unidade do cadastro de Cliente

Cole este prompt no agente/chat do repositório **frontend**.

---

## Contexto

O backend **já foi atualizado**: **cliente não tem mais vínculo com unidade**.

| Antes | Agora |
|-------|--------|
| `Cliente.unidadeId` obrigatório | Campo **removido** do model / API |
| ADMIN precisava enviar `unidadeId` no `POST /clientes` | **Não enviar** — erro antigo `"unidadeId é obrigatório para criar cliente"` **não existe mais** |
| Listagem filtrada pela unidade do JWT | Lista **todos** os clientes |
| Resposta do cliente incluía `unidadeId` | Campo **não vem mais** no JSON |

`User.unidadeId` continua existindo como legado opcional, mas **não é derivado do cliente**.

Documentação antiga `FRONTEND-UNIDADE-ID-CLIENTE.md` (pedir unidade no create) está **obsoleta** — ignorar.

Referência backend: `src/services/cliente.service.ts`, `CreateClienteDTO` em `src/types/dtos.ts`, migration `remove_cliente_unidade_id`.

---

## Pedido

Ajustar telas e tipos de **Clientes** (e qualquer lugar que leia `cliente.unidadeId`).

### 1. Remover campo Unidade do formulário de cliente

- Remover select/input **"Unidade"** em criar e editar cliente
- Remover do state do form qualquer `unidadeId`
- Remover validação do tipo “selecione a unidade” / “unidade obrigatória para ADMIN”
- Remover hooks só usados para listar unidades na tela de clientes (ex.: `useUnidades`)

### 2. Payload de create / update

**Não** enviar `unidadeId` em:

- `POST /clientes`
- `PUT /clientes/:id`

Exemplo de create válido:

```json
{
  "razaoSocial": "TechSolutions Sistemas LTDA",
  "nomeFantasia": "TechSolutions",
  "cnpj": "12.345.678/0001-90",
  "endereco": "Av. Paulista, 1000",
  "cidade": "São Paulo",
  "estado": "SP",
  "cep": "01310-100",
  "ramoAtividadeId": 1,
  "contato": {
    "nome": "Maria",
    "email": "maria@empresa.com",
    "principal": true
  },
  "contrato": {
    "numeroContrato": "C-001",
    "dataInicio": "2026-01-01T00:00:00.000Z",
    "dataFim": "2026-12-31T00:00:00.000Z",
    "valorMensal": 1500,
    "descricaoServicos": "Suporte"
  }
}
```

### 3. Tipos TypeScript

```ts
// Remover unidadeId de Cliente / CreateCliente / UpdateCliente
type Cliente = {
  id: number;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  // ...demais campos — SEM unidadeId
};
```

Atualizar Zod/Yup/schemas se existirem.

### 4. Listagens e detalhes

- Coluna **Unidade** na tabela de clientes → remover
- Badge/chip de unidade no card/detalhe → remover
- Filtro “por unidade” na listagem de clientes → remover
- Qualquer `cliente.unidadeId` em relatórios/calendário/KPIs no front → não depender mais desse campo

### 5. Não confundir com usuário

- Cadastro de **usuário**: campo Unidade já deve ter sido removido (ver `FRONTEND-USUARIO-SEM-UNIDADE.md`)
- Cadastro de **cliente**: agora também **sem** unidade
- Não reintroduzir seletor de unidade “porque o ADMIN não tem `user.unidadeId`”

### 6. Tratamento de erros

Remover handlers específicos para:

```txt
unidadeId é obrigatório para criar cliente
```

### 7. Checklist de teste

- [ ] ADMIN cria cliente sem campo/unidade — sucesso 201
- [ ] TECNICO cria cliente sem unidade — sucesso 201
- [ ] Listagem mostra todos os clientes (sem filtro por unidade)
- [ ] Editar cliente não envia nem exige `unidadeId`
- [ ] Tipos/compilação sem `cliente.unidadeId`
- [ ] UI sem select/coluna/filtro de unidade em Clientes

---

## Endpoints

| Método | Rota | Nota |
|--------|------|------|
| `GET` | `/clientes` | Sem isolamento por unidade |
| `POST` | `/clientes` | Sem `unidadeId` no body |
| `GET` | `/clientes/:id` | Resposta sem `unidadeId` |
| `PUT` | `/clientes/:id` | Sem `unidadeId` |
