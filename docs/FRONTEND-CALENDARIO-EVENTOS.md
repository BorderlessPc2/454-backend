# Prompt — Frontend: calendário de organização (sem relatório)

Cole este prompt no agente/chat do repositório **frontend**.

---

## Contexto

O backend **foi corrigido**. O calendário **não cria mais relatório**.

Antes: `POST /relatorios/agendamento` criava um `Relatorio` com status `AGENDADO`.  
Agora: eventos vivem em `/calendario/eventos` — só organização da equipe.

| Campo | Significado |
|-------|-------------|
| `dataInicio` | YYYY-MM-DD (inclusivo) |
| `dataFim` | YYYY-MM-DD (inclusivo) — pode ser **igual** a `dataInicio` (1 dia) |
| Multi-dia | Ex.: 20→22 → o calendário deve pintar **20, 21 e 22** |

Resposta FullCalendar:

```json
{
  "id": "7",
  "title": "Demanda sprint",
  "start": "2026-07-20",
  "end": "2026-07-23",
  "allDay": true,
  "classNames": ["calendario-evento"],
  "extendedProps": {
    "dataInicio": "2026-07-20",
    "dataFim": "2026-07-22",
    "descricao": "Alinhar prioridades",
    "clienteId": 3,
    "clienteNome": "TechSolutions",
    "criadoPorId": 1,
    "criadoPorNome": "Admin"
  }
}
```

Importante: com `allDay: true`, o FullCalendar trata `end` como **exclusivo**.  
O backend já devolve `end = dataFim + 1 dia`. Use `start`/`end`/`allDay` direto no FC.  
Para formulários/exibição, use `extendedProps.dataInicio` e `extendedProps.dataFim` (inclusivos).

---

## Endpoints novos (usar estes)

| Método | Rota | Ação |
|--------|------|------|
| `GET` | `/calendario/eventos?dataInicio=&dataFim=` | Lista (overlap com o range da view) |
| `POST` | `/calendario/eventos` | Cria evento (**não** cria relatório) |
| `GET` | `/calendario/eventos/:id` | Detalhe |
| `PUT` | `/calendario/eventos/:id` | Atualiza |
| `DELETE` | `/calendario/eventos/:id` | Remove |

Filtros opcionais na listagem: `clienteId`, `criadoPorId`.

### Create — body

```json
{
  "titulo": "Visita / demanda X",
  "descricao": "Opcional",
  "dataInicio": "2026-07-20",
  "dataFim": "2026-07-22",
  "clienteId": 3
}
```

- `titulo`, `dataInicio`, `dataFim` obrigatórios
- `clienteId` opcional (`null` ou omitir)
- Mesmo dia: `"dataInicio": "2026-07-20", "dataFim": "2026-07-20"`

### Rotas antigas

| Rota | Status |
|------|--------|
| `GET /relatorios/calendario` | Alias depreciado → mesmos eventos novos |
| `POST /relatorios/agendamento` | **410 Gone** — não usar |

---

## Pedido no front

### 1. Formulário de evento

- Campos: **título**, **data início**, **data fim**, descrição (opcional), cliente (opcional)
- Validar `dataFim >= dataInicio`
- Permitir mesmo dia
- **Não** chamar create de relatório / agendamento

### 2. FullCalendar

- Fonte: `GET /calendario/eventos` com o range visível (`dataInicio`/`dataFim` da view)
- Eventos com `allDay: true`
- Multi-dia deve aparecer em **todos** os dias do intervalo inclusivo
- Drag/resize (se houver): `PUT` com novas `dataInicio`/`dataFim` (inclusivas, derivadas do FC)

### 3. Remover acoplamento com relatório

- Remover fluxo “criar agendamento → relatório AGENDADO”
- Card “Próximos agendamentos” do dashboard: usar `/calendario/eventos` (não filtrar por `status: AGENDADO`)
- Relatório continua só em `/relatorios` (visita concluída)

### 4. Permissões

- Qualquer autenticado lista/cria
- Editar/excluir: autor ou ADMIN (403 caso contrário)

### 5. Checklist

- [ ] Criar evento 1 dia → aparece só nesse dia
- [ ] Criar evento 3 dias → aparece nos 3 dias
- [ ] Create **não** gera item em `/relatorios`
- [ ] `POST /relatorios/agendamento` não é mais usado
- [ ] Editar datas / excluir funciona
- [ ] Dashboard “próximos” lê `/calendario/eventos`

---

## Referência backend

- Rotas: `src/routes/calendario.routes.ts`
- Service: `src/services/calendario-evento.service.ts`
- Model: `CalendarioEvento` em `prisma/schema.prisma`
