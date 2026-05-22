# Checklist de regressão manual (fluxos críticos)

Execute após migrations relevantes ou antes de comunicar um release importante. Adaptar usuários URLs ao ambiente (local / staging / prod).

## Autenticação e perfis

- [ ] Login **ADMIN** (`POST /auth/login`) — dentro da janela de horário se existir na tabela `configuracoes`.
- [ ] Login **TECNICO** — recebe JWT com `unidadeId`.
- [ ] Tentativa login fora da janela (se configurada) deve retornar **403** com mensagem explícita.
- [ ] JWT expira dentro do tempo configurado **`JWT_EXPIRES_IN`** — após esse tempo chamada autenticada deve **401**.

## Clientes / unidades (escopo)

- [ ] **ADMIN**: lista/global conforme modelo atual.
- [ ] **TECNICO**: lista só clientes da sua `unidadeId`; **403** se técnico sem unidade nos endpoints escopados.

## Relatórios

- [ ] Listar relatórios (técnico vê todos da **unidade**).
- [ ] Visualizar relatório por id e dados para PDF (`GET …/pdf` ou layout).
- [ ] Editar relatório apenas se **TECNICO** criador (**403** caso contrário); **ADMIN** dentro do modelo atual.
- [ ] Observações/detaliamento e PDF: espaçamentos visuais — validar apenas no **frontend** onde o CSS do PDF está.

## Configurações (ADMIN)

- [ ] **`GET /configurações`** retorna rodapé, logo e horários esperados após atualização via **`PUT`**.
- [ ] **`PUT /configurações`** parcial só com `textoRodapeRelatorio` ou só horário.
- [ ] **`POST /configurações/logo`** (multipart logo) atualiza arquivo e campo `logoUrl` resolvível no browser.

## Health

- [ ] **`GET /health`** retorna `{ ok: true, … }` com uptime.
- [ ] **`GET /health/db`** retorna `{ database: true }` quando Postgres saudável.
