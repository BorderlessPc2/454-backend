# Frontend: Dashboard (KPIs)

Este repositório é só o **backend**. A tela **Navegação → Dashboard** deve consumir o endpoint abaixo.

## Endpoint principal

| Método | Rota | Auth |
|--------|------|------|
| `GET` | `/dashboard/kpis` | Bearer (usuário autenticado) |

Base URL: `import.meta.env.VITE_API_URL ?? "http://localhost:3000"`

> **TECNICO** fora do horário configurado recebe **403** (`code: "FORBIDDEN"`). ADMIN sempre passa.

---

## Query params

| Param | Obrigatório | Formato | Quem pode usar |
|-------|-------------|---------|----------------|
| `dataInicio` | Não* | `YYYY-MM-DD` | Todos |
| `dataFim` | Não* | `YYYY-MM-DD` | Todos |
| `unidadeId` | Não | inteiro ≥ 1 | **ADMIN** |
| `tecnicoId` | Não | inteiro ≥ 1 | **ADMIN** |
| `clienteId` | Não | inteiro ≥ 1 | **ADMIN** |
| `setorId` | Não | inteiro ≥ 1 | Todos |

\* Se omitir **ambos**, o backend usa o período padrão: **dia 1 do mês corrente até hoje**.  
Se informar um, **deve informar os dois**.

### Conversão do date range picker

O filtro `"01 jul 2024 — 31 jul 2024"` deve virar:

```
dataInicio=2024-07-01&dataFim=2024-07-31
```

```ts
function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
```

### Filtros "Todos"

Não enviar o query param quando o usuário escolher "Todas as unidades", "Todos os técnicos", etc.

---

## Resposta por papel

A resposta **muda conforme `user.role`**. Use type guard no front:

```ts
function isAdminKpis(data: DashboardKpisResponse): data is DashboardKpisAdminResponse {
  return "visitasSla" in data;
}
```

### ADMIN — `DashboardKpisAdminResponse`

```json
{
  "visitasSla": {
    "realizadas": 42,
    "esperadas": 60
  },
  "totalHoras": "128.50",
  "contratosSlaRisco": [
    {
      "clienteId": 3,
      "clienteNomeFantasia": "Mercado do Povo",
      "contratoId": 10,
      "visitasRealizadas": 1,
      "visitasEsperadas": 4,
      "percentualConcluido": 25
    }
  ],
  "produtividadeTecnicos": [
    {
      "tecnicoId": 2,
      "tecnicoNome": "João Silva",
      "totalVisitas": 15,
      "totalHoras": "48.00"
    }
  ],
  "topClientes": [
    {
      "clienteId": 1,
      "clienteNomeFantasia": "Empresa ABC",
      "totalVisitas": 8
    }
  ]
}
```

| Campo | Uso na UI (ADMIN) |
|-------|-------------------|
| `visitasSla.realizadas` / `visitasSla.esperadas` | Card "Visitas SLA" (ex.: `42 / 60`) |
| `totalHoras` | Card "Total de Horas" — string decimal (`"128.50"` = 128h30) |
| `contratosSlaRisco` | Lista/tabela de contratos abaixo da meta no mês |
| `produtividadeTecnicos` | Ranking de técnicos no período |
| `topClientes` | Top 10 clientes por visitas |

### TECNICO — `DashboardKpisTecnicoResponse`

```json
{
  "visitas": {
    "realizadas": 5,
    "agendadas": 2
  },
  "totalHoras": "24.00",
  "topClientes": [
    {
      "clienteId": 1,
      "clienteNomeFantasia": "Empresa ABC",
      "totalVisitas": 3
    }
  ]
}
```

| Campo | Uso na UI (TECNICO) |
|-------|---------------------|
| `visitas.realizadas` | Card **"Minhas Visitas"** (finalizadas no período) |
| `visitas.agendadas` | Pode complementar o card (agendadas no período) |
| `totalHoras` | Card **"Minhas Horas"** |
| `topClientes` | Ranking dos seus clientes |

> **Não** usar labels de TECNICO ("Minhas Visitas") na visão ADMIN. ADMIN deve exibir `visitasSla`, `produtividadeTecnicos`, etc.

---

## Formato de horas

`totalHoras` vem como **string decimal** com 2 casas (`"12.50"` = 12h30), **não** como `HH:mm`.

```ts
function formatHorasDecimal(hhmm: string): string {
  const h = Number(hhmm);
  if (Number.isNaN(h)) return "00:00";
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// "12.50" → "12:30"
```

---

## Próximos agendamentos (lista)

O endpoint `/dashboard/kpis` **não** retorna lista de agendamentos futuros — só contagem (`visitas.agendadas` para TECNICO).

Para o card **"Próximos Agendamentos"**, use em paralelo:

| Método | Rota |
|--------|------|
| `GET` | `/relatorios/calendario` |

Query params:

- `dataInicio` (obrigatório): hoje em `YYYY-MM-DD`
- `dataFim` (obrigatório): ex. +30 ou +90 dias
- `clienteId`, `tecnicoId` (opcionais, ADMIN)

Filtrar no front eventos com `extendedProps.status === "AGENDADO"` e `start >= agora`, ordenar por `start`.

```ts
const hoje = toYmd(new Date());
const em30Dias = toYmd(new Date(Date.now() + 30 * 86400000));

const res = await fetch(
  `${API_BASE}/relatorios/calendario?dataInicio=${hoje}&dataFim=${em30Dias}`,
  { headers: { Authorization: `Bearer ${token}` } },
);
const eventos = await res.json();
const proximos = eventos
  .filter((e) => e.extendedProps?.status === "AGENDADO")
  .filter((e) => new Date(e.start) >= new Date())
  .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
```

---

## Endpoints auxiliares (dropdowns dos filtros)

Não existe rota `/unidades`. `unidadeId` é um número no cadastro de usuários/clientes.

| Filtro | Endpoint sugerido |
|--------|-------------------|
| Unidade | `GET /users` (ADMIN) — extrair `unidadeId` distintos dos usuários |
| Técnico | `GET /users/tecnico` |
| Cliente | `GET /clientes` |
| Setor | `GET /setores` |

Todos exigem `Authorization: Bearer <token>`.

---

## Erros HTTP

| Status | Quando |
|--------|--------|
| 400 | `dataInicio`/`dataFim` inválidos, só um informado, início > fim, setor/técnico não encontrado |
| 401 | Token ausente/inválido |
| 403 | TECNICO usando filtros admin; usuário sem unidade; fora do horário (TECNICO) |
| 503 | Falha ao verificar horário de acesso |

Corpo de erro: `{ "error": "mensagem" }` (horário: também `code: "FORBIDDEN"`).

---

## Tipos TypeScript

```ts
export interface VisitasSlaKpi {
  realizadas: number;
  esperadas: number;
}

export interface ContratoSlaRiscoItem {
  clienteId: number;
  clienteNomeFantasia: string;
  contratoId: number;
  visitasRealizadas: number;
  visitasEsperadas: number;
  percentualConcluido: number;
}

export interface ProdutividadeTecnicoKpiItem {
  tecnicoId: number | null;
  tecnicoNome: string;
  totalVisitas: number;
  totalHoras: string;
}

export interface TopClienteKpiItem {
  clienteId: number;
  clienteNomeFantasia: string;
  totalVisitas: number;
}

export interface DashboardKpisAdminResponse {
  visitasSla: VisitasSlaKpi;
  totalHoras: string;
  contratosSlaRisco: ContratoSlaRiscoItem[];
  produtividadeTecnicos: ProdutividadeTecnicoKpiItem[];
  topClientes: TopClienteKpiItem[];
}

export interface DashboardKpisTecnicoResponse {
  visitas: { realizadas: number; agendadas: number };
  totalHoras: string;
  topClientes: TopClienteKpiItem[];
}

export type DashboardKpisResponse =
  | DashboardKpisAdminResponse
  | DashboardKpisTecnicoResponse;
```

---

## Exemplo: serviço + botão "Aplicar Filtros"

```ts
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type DashboardFilters = {
  dataInicio?: string;
  dataFim?: string;
  unidadeId?: number;
  tecnicoId?: number;
  clienteId?: number;
  setorId?: number;
};

function buildDashboardKpisUrl(filters: DashboardFilters): string {
  const q = new URLSearchParams();
  if (filters.dataInicio) q.set("dataInicio", filters.dataInicio);
  if (filters.dataFim) q.set("dataFim", filters.dataFim);
  if (filters.unidadeId != null) q.set("unidadeId", String(filters.unidadeId));
  if (filters.tecnicoId != null) q.set("tecnicoId", String(filters.tecnicoId));
  if (filters.clienteId != null) q.set("clienteId", String(filters.clienteId));
  if (filters.setorId != null) q.set("setorId", String(filters.setorId));
  const qs = q.toString();
  return `${API_BASE}/dashboard/kpis${qs ? `?${qs}` : ""}`;
}

export async function fetchDashboardKpis(
  token: string,
  filters: DashboardFilters,
): Promise<DashboardKpisResponse> {
  const res = await fetch(buildDashboardKpisUrl(filters), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Erro ${res.status}`);
  }
  return res.json();
}
```

```tsx
async function onAplicarFiltros() {
  setLoading(true);
  setError(null);
  try {
    const data = await fetchDashboardKpis(token, {
      dataInicio: toYmd(periodo.inicio),
      dataFim: toYmd(periodo.fim),
      unidadeId: unidadeSelecionada ?? undefined,
      tecnicoId: tecnicoSelecionado ?? undefined,
      clienteId: clienteSelecionado ?? undefined,
      setorId: setorSelecionado ?? undefined,
    });

    if (user.role === "ADMIN" && "visitasSla" in data) {
      setKpisAdmin(data);
    } else {
      setKpisTecnico(data as DashboardKpisTecnicoResponse);
    }
  } catch (e) {
    setError(e instanceof Error ? e.message : "Falha ao carregar dashboard");
  } finally {
    setLoading(false);
  }
}
```

Carregar KPIs no **mount** da página (sem filtros = mês corrente até hoje) e de novo ao clicar **Aplicar Filtros**.

---

## Checklist de integração

- [ ] Chamar `GET /dashboard/kpis` com Bearer token
- [ ] Converter date range para `YYYY-MM-DD` (não enviar texto formatado)
- [ ] Omitir filtros em "Todos"
- [ ] Renderizar UI diferente para ADMIN vs TECNICO
- [ ] Converter `totalHoras` decimal → `HH:mm` se a UI usar relógio
- [ ] Card "Próximos Agendamentos": `GET /relatorios/calendario` + filtro `AGENDADO`
- [ ] TECNICO: não enviar `unidadeId`, `tecnicoId`, `clienteId`
- [ ] Tratar listas vazias (`[]`) como estado vazio válido
- [ ] Exibir `error` do JSON em falhas

---

## Exemplo cURL

```bash
curl -s "http://localhost:3000/dashboard/kpis?dataInicio=2024-07-01&dataFim=2024-07-31" \
  -H "Authorization: Bearer SEU_TOKEN"
```
