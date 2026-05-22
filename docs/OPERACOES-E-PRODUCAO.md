# Operações, produção (Render / Netlify) e governança

Guia objetivo para o checklist de **monitoramento**, **schema**, **assets**, **regressão**, **JWT**, **backup** e **limpeza** — sem quebrar o fluxo atual do projeto.

## 1. Monitoramento de logs e observabilidade (Render / Netlify)

### Render — Web Service (backend Node)

| Ação | Onde |
|------|------|
| Logs em tempo real | Painel Render → seu serviço → **Logs** |
| Alarmes sobre **500 persistentes**, cold start, timeouts | Monitores internos Render / alertas de e‑mail quando disponível no plano |
| Métricas de latência **GET `/health`** | Use health check já configurado no `render.yaml` (`healthCheckPath: /health`) |

Endpoints úteis (sem autenticação):

- **`GET /health`** — liveness (`ok`, `uptimeSeconds`, `timestamp`).
- **`GET /health/db`** — consegue ping no Postgres (`503` se o banco cair).

Log estruturado **opcional** (uma linha JSON por request, útil para buscar falhas nos logs Render):

```env
OPS_REQUEST_LOG=1
```

Só habilite se precisar de auditoria volumétrica (aumenta tráfego de log).

### Netlify — frontend SPA

Netlify só hospeda HTML/JS **estático**. Falhas lá aparecem como **build failed** logs ou erro de SPA no navegador (network). Correlacionar **horário da falha Netlify com logs Render** quando o problema for API.

---

## 2. Auditoria do banco (PostgreSQL / Prisma)

### Antes ou após cada deploy importante

Na máquina de desenvolvimento (com `DATABASE_URL` apontando para o **mesmo** DB que você quer auditar):

```powershell
npm run db:migrate-status
```

Ou:

```powershell
npx prisma migrate status
```

- **Verde / “Applied”**: migrations alinhadas.
- Drift estrutural: se alguém alterou tabelas fora das migrations → `prisma db pull` (só análise) ou corrigir com migration nova — **não** editar migrações antigas já aplicadas.

### Produção (Render)

No arranque do container, já roda **`prisma migrate deploy`** em `scripts/start.sh`. Se uma migration nova não foi aplicada nos logs de deploy → corrigir e redeployar.

---

## 3. Performance e distribuição de imagens (`logo_url` / `/uploads`)

- A logo do sistema vai para **`uploads/`** no disco do processo (`express.static`). Em **containers efêmeros** (Docker no Render sem volume persistente), **arquivos enviados podem sumir ao redeploy**.
- Preferência recomendável em produção: guardar **`logoUrl` absoluto HTTPS** num CDN ou storage estável (`PUT /configuracoes` pode enviar apenas `logoUrl`).
- Pasta **`uploads/`** está no `.gitignore`; não há versionamento das imagens binárias.

Testes rápidos (manual):

1. **`GET /configuracoes`** com token — ver campo `logoUrl` resolvido.
2. No browser, **`GET`** da URL absoluta ou `GET https://API/uploads/…` sob **Chrome throttling**.

---

## 4. Testes de regressão / fluxos E2E (manual)

Lista detalhada: **[REGRESSAO-E2E-CHECKLIST.md](./REGRESSAO-E2E-CHECKLIST.md)**.

Para automação posterior, sugere-se Playwright contra front + staging; não é obrigatório para esta entrega backend-only.

---

## 5. Segurança e sessão JWT

| Aspecto | Comportamento |
|---------|----------------|
| **`JWT_SECRET`** (`src/lib/jwt-secret.ts`) | **Produção:** obrigatório, não pode ser o valor de exemplo, **≥ 32 caracteres**. **Dev:** placeholder permitido com aviso no log. |
| **`JWT_EXPIRES_IN`** | Padrão `8h` no `AuthService` (ex.: `12h`, `1d`). |
| **Brute force em login** | Rate limit só em **`POST /auth/login`** (`LOGIN_RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_WINDOW_MINUTES`). Com **`trust proxy`** em produção (Render) o limite usa o IP do cliente. |
| **Headers HTTP** | **`helmet`** (CSP desligada para compatibilidade com Swagger/SPA). |
| **Corpo JSON** | Limite **512 KB** (`express.json`). |
| **Swagger em produção** | Por omissão **desligado**; ativar com **`EXPOSE_API_DOCS=1`** se necessário. |

Menor validade JWT ⇒ mais seguro contra roubo do token.  
Maior validade ⇒ menos interrupções em campo.

---

## 6. Backup e disaster recovery

Resumo rápido: **[backup-e-dr.md](./backup-e-dr.md)** — `pg_dump` offsite, recuperação conceitual, limitações Render free.

---

## 7. Limpeza técnica (dívida de código)

- **`fix-horario.ts` (raiz)**: script **pontual** legado para consertar janela de login; só execute se sua equipe souber do contexto. Pode ficar até haver comando substituto no admin.
- **`scripts/verify-login-credentials.mjs`** + **`npm run verify-login`**: ferramenta **intencional** de diagnóstico de login contra o Postgres (credencial vs hash **sem** rodar servidor). Integra o checklist — **manter**.
- Scripts em **`scripts/`**: `normalize-render-database-url.mjs`, `start.sh`, `copy-openapi.mjs`, `verify-login-credentials.mjs`.

Remover apenas ficheiros após mover lógica documentada aqui ou substituindo por migrações/código definitivo — evitar deletes “ciegas” por housekeeping.