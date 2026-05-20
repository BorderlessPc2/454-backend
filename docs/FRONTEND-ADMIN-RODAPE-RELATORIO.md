# Frontend: rodapé do relatório (ADMIN)

Este repositório é só o **backend**. No seu app (ex.: Vite + React na porta 5173), use os endpoints abaixo na aba **Administração → Configurações**.

## API

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `GET` | `/configuracoes` | Bearer (qualquer usuário autenticado) | Retorna `{ dataInicio, dataFim, textoRodapeRelatorio, ... }` ou `null` |
| `PUT` | `/configuracoes` | Bearer **ADMIN** | Corpo **parcial**: envie `textoRodapeRelatorio` só, ou `dataInicio` + `dataFim` só, ou os dois |

### Exemplo: salvar só o rodapé

```http
PUT /configuracoes
Authorization: Bearer <token_admin>
Content-Type: application/json

{
  "textoRodapeRelatorio": "<p>Linha 1</p><p>Assinaturas: _____</p>"
}
```

Para limpar o texto: `"textoRodapeRelatorio": null`

### Exemplo React (trecho)

Ajuste `API_BASE` e o hook/contexto de auth que você já usa.

```tsx
import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type Config = {
  textoRodapeRelatorio: string | null;
  dataInicio: string;
  dataFim: string;
};

export function AdminRodapeRelatorioFields({ token }: { token: string }) {
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/configuracoes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: Config | null = await r.json();
        if (ok && data?.textoRodapeRelatorio != null) {
          setTexto(data.textoRodapeRelatorio);
        }
      } finally {
        if (ok) setLoading(false);
      }
    })();
    return () => {
      ok = false;
    };
  }, [token]);

  async function salvar() {
    setSaved(false);
    const r = await fetch(`${API_BASE}/configuracoes`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ textoRodapeRelatorio: texto }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? r.statusText);
    }
    setSaved(true);
  }

  if (loading) return <p>Carregando…</p>;

  return (
    <section>
      <h2>Rodapé do relatório</h2>
      <p className="hint">
        Texto exibido no rodapé do PDF/impressão do relatório. Aceita HTML se o seu gerador de PDF renderizar.
      </p>
      <textarea
        rows={8}
        className="w-full border rounded p-2 font-mono text-sm"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Endereço · telefone · texto legal…"
      />
      <button type="button" onClick={() => void salvar()} className="mt-2 px-4 py-2 bg-neutral-800 text-white rounded">
        Salvar rodapé
      </button>
      {saved && <p className="text-green-600 mt-2">Salvo.</p>}
    </section>
  );
}
```

Incorpore esse bloco na mesma tela em que você já edita **horário de login**: ao salvar horário, continue enviando `dataInicio` e `dataFim` no mesmo `PUT` se quiser atualizar tudo de uma vez:

```json
{
  "dataInicio": "2026-05-20T08:00:00.000Z",
  "dataFim": "2026-05-20T18:00:00.000Z",
  "textoRodapeRelatorio": "<p>…</p>"
}
```

## Onde o texto fica no banco

Tabela **`configuracoes`**, coluna **`texto_rodape_relatorio`** (`TEXT`, nullable), no mesmo registro que já guarda `data_inicio` / `data_fim` do login.

Após deploy, rode **`prisma migrate deploy`** (no Render isso já está no `scripts/start.sh`).
