# Frontend: Configurações — Horário de login

Este repositório é só o **backend**. Na tela **Administração → Configurações** (card *Horário Permitido de Login*), use os endpoints abaixo.

Base URL: `import.meta.env.VITE_API_URL ?? "http://localhost:3000"`

---

## Endpoints

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `GET` | `/configuracoes` | Bearer **ADMIN** | Carrega horário, rodapé e logo |
| `PUT` | `/configuracoes` | Bearer **ADMIN** | Salva horário e/ou rodapé (corpo parcial) |
| `POST` | `/configuracoes/logo` | Bearer **ADMIN** | Upload da logo (multipart) |
| `GET` | `/configuracoes/pdf` | Bearer (qualquer autenticado) | Só branding do PDF (sem horário) |

---

## Bug atual: 05:00 / 16:00 em vez de 08:00 / 19:00

Se você salvou **08:00–19:00** e a tela mostra **05:00–16:00**, o front está convertendo fuso com `Date`:

```ts
// API retorna dataInicio: "1970-01-01T08:00:00.000Z" e horaInicio: "08:00"
new Date("1970-01-01T08:00:00.000Z").getHours() // → 5 no Brasil (UTC-3)
new Date("1970-01-01T19:00:00.000Z").getHours() // → 16 no Brasil
```

**Correção:** use `config.horaInicio` / `config.horaFim` **sem** `new Date()`.

```ts
// ✅ CORRETO — copie para o componente de Configurações
function horarioFromConfig(config: ConfiguracaoResponse) {
  return {
    inicio: config.horaInicio,
    fim: config.horaFim,
  };
}

// Alternativa legada (se não puder usar horaInicio ainda)
function horarioFromConfigLegado(config: ConfiguracaoResponse) {
  return {
    inicio: config.dataInicio.slice(11, 16), // "08:00" do ISO
    fim: config.dataFim.slice(11, 16),
  };
}
```

---

### Campos na resposta (`GET` e `PUT`)

| Campo | Tipo | Exemplo | Uso no front |
|-------|------|---------|--------------|
| `horaInicio` | `string` | `"08:00"` | **Preferencial** — bind direto em `<input type="time">` |
| `horaFim` | `string` | `"19:00"` | **Preferencial** |
| `dataInicio` | `string` | `"1970-01-01T08:00:00.000Z"` | ISO âncora 1970 (legado: `.slice(11, 16)` → `"08:00"`) |
| `dataFim` | `string` | `"1970-01-01T19:00:00.000Z"` | ISO âncora 1970 |

> **Preferencial:** use `horaInicio` / `horaFim` direto no input.  
> **Legado:** se o código faz `config.dataInicio.slice(11, 16)`, continue usando `dataInicio` ISO — **não** use `new Date(dataInicio)`.

### Exemplo `GET /configuracoes`

```json
{
  "id": 1,
  "horaInicio": "08:00",
  "horaFim": "19:00",
  "dataInicio": "1970-01-01T08:00:00.000Z",
  "dataFim": "1970-01-01T19:00:00.000Z",
  "textoRodapeRelatorio": "<p>...</p>",
  "logoUrl": "http://localhost:3000/uploads/system-logo.png",
  "createdAt": "2026-01-15T12:00:00.000Z",
  "updatedAt": "2026-07-02T18:30:00.000Z"
}
```

Se não existir registro no banco, o `GET` retorna defaults:

```json
{
  "id": null,
  "horaInicio": "08:00",
  "horaFim": "18:00",
  "dataInicio": "1970-01-01T08:00:00.000Z",
  "dataFim": "1970-01-01T18:00:00.000Z",
  "textoRodapeRelatorio": null,
  "logoUrl": null
}
```

---

## Salvar horário (`PUT /configuracoes`)

Envie **os dois** horários juntos. Formato recomendado:

```http
PUT /configuracoes
Authorization: Bearer <token_admin>
Content-Type: application/json

{
  "horaInicio": "08:00",
  "horaFim": "19:00"
}
```

### Aliases aceitos no body

| Preferido | Alternativas |
|-----------|--------------|
| `horaInicio` | `dataInicio`, `hora_inicio`, `data_inicio` |
| `horaFim` | `dataFim`, `hora_fim`, `data_fim` |

### Formatos aceitos por campo

- `"08:00"` / `"19:00"` — **recomendado**
- ISO com hora literal: `"2026-07-02T08:00:00.000Z"` (extrai `08:00` do texto)

### Corpo parcial

Pode salvar só horário, só rodapé, ou os dois no mesmo `PUT`:

```json
{
  "horaInicio": "08:00",
  "horaFim": "19:00",
  "textoRodapeRelatorio": "<p>Rodapé</p>"
}
```

Para alterar **apenas** o rodapé sem mudar horário, **omita** `horaInicio`/`horaFim`.  
Para alterar **apenas** o horário, **omita** `textoRodapeRelatorio`.

---

## Tipos TypeScript

```ts
export interface ConfiguracaoResponse {
  id: number | null;
  horaInicio: string; // "HH:mm" — USE ESTE nos inputs
  horaFim: string;    // "HH:mm" — USE ESTE nos inputs
  dataInicio: string; // ISO "1970-01-01T08:00:00.000Z" — NÃO usar new Date()
  dataFim: string;    // ISO "1970-01-01T19:00:00.000Z"
  textoRodapeRelatorio: string | null;
  logoUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalvarHorarioPayload {
  horaInicio: string;
  horaFim: string;
}
```

---

## Serviço + hook React

```ts
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function fetchConfiguracoes(
  token: string,
): Promise<ConfiguracaoResponse> {
  const res = await fetch(`${API_BASE}/configuracoes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Erro ${res.status}`);
  }
  return res.json();
}

export async function salvarHorarioLogin(
  token: string,
  horaInicio: string,
  horaFim: string,
): Promise<ConfiguracaoResponse> {
  const res = await fetch(`${API_BASE}/configuracoes`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ horaInicio, horaFim }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Erro ${res.status}`);
  }
  return res.json();
}
```

### Carregar na tela (mount)

```tsx
useEffect(() => {
  let ativo = true;
  (async () => {
    try {
      const config = await fetchConfiguracoes(token);
      if (!ativo) return;
      // Use horaInicio/horaFim direto — NÃO converta com Date
      setHoraInicio(config.horaInicio);
      setHoraFim(config.horaFim);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar");
    }
  })();
  return () => { ativo = false; };
}, [token]);
```

### Salvar (botão Salvar / submit do card)

```tsx
async function onSalvarHorario() {
  setSalvando(true);
  setErro(null);
  try {
    const config = await salvarHorarioLogin(token, horaInicio, horaFim);
    setHoraInicio(config.horaInicio);
    setHoraFim(config.horaFim);
    setSucesso(true);
  } catch (e) {
    setErro(e instanceof Error ? e.message : "Falha ao salvar");
  } finally {
    setSalvando(false);
  }
}
```

### Bind com `<input type="time">`

```tsx
<input
  type="time"
  value={horaInicio}
  onChange={(e) => setHoraInicio(e.target.value)}
/>
<input
  type="time"
  value={horaFim}
  onChange={(e) => setHoraFim(e.target.value)}
/>
```

`type="time"` já produz `"HH:mm"` — envie esse valor direto no `PUT`.

---

## Aviso "fora do intervalo configurado"

Compare horários como **minutos do dia**, sem `Date` / fuso:

```ts
function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function isHorarioAtualDentroDoIntervalo(
  horaInicio: string,
  horaFim: string,
  agora = new Date(),
): boolean {
  const start = hhmmToMinutes(horaInicio);
  const end = hhmmToMinutes(horaFim);
  const now = agora.getHours() * 60 + agora.getMinutes();

  if (start <= end) {
    return now >= start && now <= end;
  }
  // janela overnight (raro em login)
  return now >= start || now <= end;
}
```

Exiba o alerta quando `!isHorarioAtualDentroDoIntervalo(horaInicio, horaFim)`.

---

## Regras de negócio (login)

- A janela vale para **TECNICO** no `POST /auth/login`.
- **ADMIN** sempre pode logar, mesmo fora do horário.
- TECNICO autenticado fora do horário também é bloqueado em rotas protegidas (`403`, `code: "FORBIDDEN"`).
- Mensagem típica: `"Login permitido apenas dentro do horario configurado"`.

---

## Erros HTTP

| Status | Quando |
|--------|--------|
| 400 | Só um horário enviado; formato inválido; fim &lt; início |
| 401 | Sem token |
| 403 | Usuário não é ADMIN |
| 500 | Falha interna |

Corpo: `{ "error": "mensagem" }`

---

## Erros comuns no front (evitar)

```ts
// ❌ ERRADO — 08:00 vira 05:00 no Brasil (UTC-3)
const h = new Date(config.dataInicio).getHours();
const m = String(new Date(config.dataInicio).getMinutes()).padStart(2, "0");
setHoraInicio(`${h}:${m}`); // → "5:00" ou "05:00"

// ❌ ERRADO — envia ISO com fuso e grava hora errada
body: JSON.stringify({
  dataInicio: new Date().setHours(8, 0).toISOString(),
})

// ✅ CERTO — carregar
setHoraInicio(config.horaInicio);
setHoraFim(config.horaFim);

// ✅ CERTO — salvar
await fetch("/configuracoes", {
  method: "PUT",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ horaInicio, horaFim }), // valores do input type="time"
});
```

---

## Checklist de integração

- [ ] `GET /configuracoes` no mount com token ADMIN
- [ ] Preencher inputs com `config.horaInicio` / `config.horaFim` (strings `HH:mm`)
- [ ] `PUT` envia `{ horaInicio, horaFim }` dos inputs
- [ ] Após salvar, atualizar estado com a **resposta** do `PUT`
- [ ] Não usar `new Date()` para exibir horário de config
- [ ] Tratar `error` do JSON em toast/alerta
- [ ] Aviso de "fora do intervalo" com comparação `HH:mm` local

---

## Rodapé e logo

- Rodapé: ver `docs/FRONTEND-ADMIN-RODAPE-RELATORIO.md`
- Logo: `POST /configuracoes/logo` (`multipart/form-data`, campo do arquivo conforme middleware de upload)

---

## cURL (debug)

```bash
# Carregar
curl -s http://localhost:3000/configuracoes \
  -H "Authorization: Bearer SEU_TOKEN_ADMIN"

# Salvar 08:00–19:00
curl -s -X PUT http://localhost:3000/configuracoes \
  -H "Authorization: Bearer SEU_TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d "{\"horaInicio\":\"08:00\",\"horaFim\":\"19:00\"}"
```
