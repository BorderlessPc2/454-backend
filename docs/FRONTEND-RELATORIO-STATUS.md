# Prompt — Frontend: Workflow de status do relatório

Cole este prompt no agente/chat do repositório **frontend**.

---

## Contexto

O backend agora tem workflow explícito de status do relatório:

| Status | Significado |
|--------|-------------|
| `AGENDADO` | Visita marcada no calendário (criada via `POST /relatorios/agendamento`) |
| `FINALIZADO` | Visita concluída / relatório pronto (default de `POST /relatorios`) |
| `CANCELADO` | Visita cancelada — **não edita conteúdo** até reabrir |

### Transições permitidas

```
AGENDADO   → FINALIZADO | CANCELADO
FINALIZADO → CANCELADO  | AGENDADO   (reabrir)
CANCELADO  → AGENDADO                (reabrir; depois finalize de novo)
```

`CANCELADO → FINALIZADO` **não** é permitido (reabra para `AGENDADO` e depois finalize).

## API

### Mudar status

```http
PATCH /relatorios/:id/status
Content-Type: application/json

{ "status": "FINALIZADO" }
```

Resposta (além do relatório serializado):

```json
{
  "status": "CANCELADO",
  "statusAnterior": "AGENDADO",
  "statusAtual": "CANCELADO",
  "transicoesPermitidas": ["AGENDADO"],
  "evento": {
    "id": "42",
    "title": "Visita - Cliente X",
    "start": "2026-07-21T08:00:00",
    "end": "2026-07-21T09:00:00",
    "status": "CANCELADO",
    "classNames": ["status-cancelado", "event-cancelado"],
    "extendedProps": {
      "status": "CANCELADO"
    }
  }
}
```

Use o campo `evento` para atualizar o item no calendário sem refetch completo (mesmo contrato de `PATCH /relatorios/:id/data-visita`).

Erros comuns (400):

- `Relatório já está com status X`
- `Transição de X para Y não é permitida...`
- `Relatório cancelado não pode ser editado...` (no `PUT /relatorios/:id`)

### Filtrar listagem

```http
GET /relatorios?status=AGENDADO
GET /relatorios?status=AGENDADO,FINALIZADO
GET /relatorios?status=AGENDADO&status=FINALIZADO
```

### Criação

- `POST /relatorios` → sempre `FINALIZADO` (visita já realizada).
- `POST /relatorios/agendamento` → sempre `AGENDADO`.
- Não envie `status` no body de create (exceto opcional `"FINALIZADO"` no POST `/relatorios`).

### Edição / reagendamento

- `PUT /relatorios/:id` bloqueado se `status === "CANCELADO"` (reabra antes).
- `PATCH /relatorios/:id/data-visita` já bloqueava `FINALIZADO` e `CANCELADO` — mantém.

## Pedido na UI

1. Exibir badge/status do relatório (`AGENDADO` / `FINALIZADO` / `CANCELADO`).
2. Ações contextuais:
   - Em **AGENDADO**: botões **Finalizar** e **Cancelar**.
   - Em **FINALIZADO**: **Cancelar** e opcionalmente **Reabrir** (`AGENDADO`).
   - Em **CANCELADO**: só **Reabrir** (`AGENDADO`); desabilitar edição de conteúdo.
3. Chamar `PATCH /relatorios/:id/status` (não misturar `status` no `PUT`).
4. Na listagem, filtro por status (chips ou select).
5. Calendário: usar `evento.status` (ou `evento.extendedProps.status`) retornado pelo `PATCH /status` para atualizar o evento na agenda; eventos `CANCELADO` podem ficar cinza/riscados via `evento.classNames`.

## Critérios de aceite

- [ ] Agendamento → Finalizar muda para `FINALIZADO` e some da fila de próximos (ou muda visual).
- [ ] Agendamento → Cancelar muda para `CANCELADO` e não permite editar até reabrir.
- [ ] Reabrir cancelado volta para `AGENDADO`.
- [ ] Filtro `?status=` funciona na listagem.
- [ ] Tentativa de transição inválida mostra mensagem do backend (400).
