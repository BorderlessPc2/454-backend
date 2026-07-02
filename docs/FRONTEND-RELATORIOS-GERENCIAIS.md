# Frontend: Relatórios Gerenciais

Este repositório é só o **backend**. No app (ex.: Vite + React na porta 5173), a tela **Navegação → Gerenciais** deve consumir o endpoint abaixo.

## Endpoint

| Método | Rota | Auth |
|--------|------|------|
| `GET` | `/relatorios/gerencial` | Bearer (usuário autenticado) |

Base URL: `import.meta.env.VITE_API_URL ?? "http://localhost:3000"`

---

## Query params (contrato da API)

| Param | Obrigatório | Valores aceitos | Observação |
|-------|-------------|-----------------|------------|
| `tipo` | **Sim** | `resumo-cliente` \| `produtividade-tecnico` \| `sla-contratos` | Slugs em kebab-case — **não** enviar labels da UI |
| `periodo` | **Sim** | `YYYY-MM` (ex.: `2024-07`) | Mês civil completo (UTC). **Não** enviar `"julho de 2024"` |
| `formato` | Não | `json` (padrão) \| `xlsx` | `json` = visualizar na tela; `xlsx` = download Excel |
| `clienteId` | Não | inteiro ≥ 1 | Filtra por cliente |
| `tecnicoId` | Não | inteiro ≥ 1 | Filtra produtividade por técnico (busca pelo nome no cadastro) |
| `unidadeId` | Não | inteiro ≥ 1 | **Somente ADMIN** — filtra por unidade |

### Mapeamento UI → API

| Label na tela (exemplo) | `tipo` |
|-------------------------|--------|
| Resumo por Cliente | `resumo-cliente` |
| Produtividade por Técnico | `produtividade-tecnico` |
| SLA de Contratos | `sla-contratos` |

| Label na tela (exemplo) | `formato` |
|-------------------------|-----------|
| Visualizar | `json` ou omitir |
| Excel / Exportar | `xlsx` |

### Conversão do date picker

O seletor de mês deve produzir `YYYY-MM` antes da requisição:

```ts
function toPeriodoYYYYMM(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// "julho de 2024" no picker → periodo=2024-07
```

---

## Permissões

| Papel | Tipos permitidos | Filtros extras |
|-------|------------------|----------------|
| **ADMIN** | todos | pode usar `unidadeId` |
| **TECNICO** | apenas `resumo-cliente` | não pode usar `unidadeId`; dados limitados à unidade do token |

- Tipos `produtividade-tecnico` e `sla-contratos` retornam **403** para TECNICO.
- Ocultar ou desabilitar opções no select conforme `user.role`.

---

## Respostas de sucesso

### `formato=json` (visualizar)

`Content-Type: application/json`

Discriminar pelo campo `tipo` na resposta:

#### `resumo-cliente`

```json
{
  "tipo": "resumo-cliente",
  "periodo": "2024-07",
  "itens": [
    {
      "clienteId": 1,
      "clienteNome": "Empresa ABC",
      "totalVisitas": 4,
      "totalHoras": 12.5,
      "totalSetoresVisitados": 3,
      "periodo": "2024-07"
    }
  ]
}
```

Colunas sugeridas na tabela: Cliente, Visitas, Horas, Setores visitados.

- `totalHoras` é **decimal** (ex.: `12.5` = 12h30). Para exibir `HH:mm`: `Math.floor(h) + "h" + Math.round((h % 1) * 60)`.

#### `produtividade-tecnico`

```json
{
  "tipo": "produtividade-tecnico",
  "periodo": "2024-07",
  "itens": [
    {
      "tecnicoNome": "João Silva",
      "totalVisitas": 8,
      "totalHoras": 24,
      "clientesAtendidos": 5,
      "periodo": "2024-07"
    }
  ]
}
```

#### `sla-contratos`

```json
{
  "tipo": "sla-contratos",
  "periodo": "2024-07",
  "itens": [
    {
      "contratoId": 10,
      "clienteNome": "Empresa ABC",
      "visitasRealizadas": 3,
      "visitasEsperadas": 4,
      "slaPercentual": 75,
      "slaStatus": "ABAIXO",
      "periodo": "2024-07"
    }
  ]
}
```

`slaStatus`:

| Valor | Significado | UI sugerida |
|-------|-------------|-------------|
| `DENTRO` | visitas realizadas ≥ esperadas | badge verde |
| `ABAIXO` | abaixo da meta | badge vermelho/amarelo |
| `SEM_META` | contrato sem `visitasMensaisEsperadas` | badge neutro; `slaPercentual` é `null` |

### `formato=xlsx` (exportar)

- `Content-Type`: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition`: `attachment; filename="relatorio-gerencial-{tipo}-{periodo}.xlsx"`
- Corpo: **binário** (não JSON). Usar `response.blob()` e disparar download no browser.

---

## Erros HTTP

| Status | Quando | `error` (exemplos) |
|--------|--------|---------------------|
| 400 | `tipo` inválido ou ausente | `"tipo inválido: use resumo-cliente, produtividade-tecnico ou sla-contratos"` |
| 400 | `periodo` ausente ou formato errado | `"periodo é obrigatório (formato YYYY-MM, ex.: 2025-01)"` / `"periodo inválido: use o formato YYYY-MM"` |
| 400 | `clienteId` / `tecnicoId` / `unidadeId` inválidos | `"clienteId inválido"` etc. |
| 400 | técnico não encontrado (filtro `tecnicoId`) | `"Técnico não encontrado"` |
| 401 | sem token / token inválido | (middleware de auth) |
| 403 | TECNICO em tipo restrito | `"Acesso negado: relatório disponível apenas para ADMIN"` |
| 403 | TECNICO com `unidadeId` | `"Técnico não pode filtrar por unidadeId"` |
| 403 | usuário sem unidade | `"Usuário sem unidade vinculada"` |

Sempre exibir `response.json().error` em toasts/mensagens.

---

## Regras de negócio (para UX)

1. **Período**: considera relatórios cuja `dataVisita` cai no mês informado.
2. **Resumo cliente / produtividade**: inclui relatórios com status diferente de `CANCELADO` (inclui `AGENDADO` e `FINALIZADO`).
3. **SLA**: só contratos **ativos** no período; visitas realizadas contam apenas relatórios **FINALIZADOS**.
4. **Escopo de unidade**: TECNICO vê só clientes da sua unidade; ADMIN vê tudo (ou filtra com `unidadeId`).
5. Lista vazia (`itens: []`) é resposta válida — mostrar estado vazio, não tratar como erro.

---

## Tipos TypeScript (copiar para o front)

```ts
export type RelatorioGerencialTipo =
  | "resumo-cliente"
  | "produtividade-tecnico"
  | "sla-contratos";

export type RelatorioGerencialFormato = "json" | "xlsx";

export type SlaStatus = "DENTRO" | "ABAIXO" | "SEM_META";

export interface ResumoClienteItem {
  clienteId: number;
  clienteNome: string;
  totalVisitas: number;
  totalHoras: number;
  totalSetoresVisitados: number;
  periodo: string;
}

export interface ProdutividadeTecnicoItem {
  tecnicoNome: string;
  totalVisitas: number;
  totalHoras: number;
  clientesAtendidos: number;
  periodo: string;
}

export interface SlaContratoItem {
  contratoId: number;
  clienteNome: string;
  visitasRealizadas: number;
  visitasEsperadas: number;
  slaPercentual: number | null;
  slaStatus: SlaStatus;
  periodo: string;
}

export type RelatorioGerencialResponse =
  | { tipo: "resumo-cliente"; periodo: string; itens: ResumoClienteItem[] }
  | { tipo: "produtividade-tecnico"; periodo: string; itens: ProdutividadeTecnicoItem[] }
  | { tipo: "sla-contratos"; periodo: string; itens: SlaContratoItem[] };
```

---

## Exemplo: serviço + hook React

Ajuste `API_BASE` e o contexto de auth existente.

```ts
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type GerarRelatorioParams = {
  tipo: RelatorioGerencialTipo;
  periodo: string; // YYYY-MM
  formato?: RelatorioGerencialFormato;
  clienteId?: number;
  tecnicoId?: number;
  unidadeId?: number;
};

function buildGerencialUrl(params: GerarRelatorioParams): string {
  const q = new URLSearchParams({
    tipo: params.tipo,
    periodo: params.periodo,
    formato: params.formato ?? "json",
  });
  if (params.clienteId != null) q.set("clienteId", String(params.clienteId));
  if (params.tecnicoId != null) q.set("tecnicoId", String(params.tecnicoId));
  if (params.unidadeId != null) q.set("unidadeId", String(params.unidadeId));
  return `${API_BASE}/relatorios/gerencial?${q}`;
}

export async function fetchRelatorioGerencial(
  token: string,
  params: GerarRelatorioParams,
): Promise<RelatorioGerencialResponse> {
  const res = await fetch(buildGerencialUrl({ ...params, formato: "json" }), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Erro ${res.status}`);
  }
  return res.json();
}

export async function downloadRelatorioGerencialXlsx(
  token: string,
  params: Omit<GerarRelatorioParams, "formato">,
): Promise<void> {
  const res = await fetch(buildGerencialUrl({ ...params, formato: "xlsx" }), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Erro ${res.status}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `relatorio-gerencial-${params.tipo}-${params.periodo}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Handler do botão "Gerar"

```tsx
async function onGerar() {
  setLoading(true);
  setError(null);
  try {
    const periodo = toPeriodoYYYYMM(periodoDate); // do date picker
    const tipo = tipoSelecionado; // slug da API, não o label

    if (formato === "xlsx") {
      await downloadRelatorioGerencialXlsx(token, { tipo, periodo });
      return;
    }

    const data = await fetchRelatorioGerencial(token, { tipo, periodo });
    setResultado(data); // renderizar tabela conforme data.tipo
  } catch (e) {
    setError(e instanceof Error ? e.message : "Falha ao gerar relatório");
  } finally {
    setLoading(false);
  }
}
```

---

## Checklist de integração

- [ ] Select **Tipo** envia slug (`resumo-cliente`), não o texto "Resumo por Cliente"
- [ ] Date picker converte para `YYYY-MM` antes do `fetch`
- [ ] Select **Formato**: "Visualizar" → `json`; export → `xlsx` + `blob` download
- [ ] Header `Authorization: Bearer <token>` em todas as chamadas
- [ ] TECNICO: esconder tipos admin-only e não enviar `unidadeId`
- [ ] Tratar `itens: []` com empty state
- [ ] Tratar 400/403 exibindo `error` do JSON
- [ ] Tabela muda colunas conforme `response.tipo` (discriminated union)

---

## Exemplo cURL (debug)

```bash
curl -s "http://localhost:3000/relatorios/gerencial?tipo=resumo-cliente&periodo=2024-07" \
  -H "Authorization: Bearer SEU_TOKEN"
```
