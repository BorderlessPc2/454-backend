# Prompt — Frontend: logo dark mode

Cole este prompt no agente/chat do repositório **frontend**.

---

## Contexto

O backend **já foi corrigido**. Antes, upload da logo dark sobrescrevia o mesmo arquivo da logo clara (`system-logo.*`), então a dark não persistia e a UI voltava para a logo padrão LINQ.

Agora:

| Variante | Endpoint | Arquivo | Campo na API |
|----------|----------|---------|--------------|
| Light | `POST /configuracoes/logo` | `/uploads/system-logo.{ext}` | `logoUrl` |
| Dark | `POST /configuracoes/logo-dark` | `/uploads/system-logo-dark.{ext}` | `logoDarkUrl` |

`GET /configuracoes` e as respostas dos uploads retornam:

```json
{
  "logoUrl": "http://localhost:3000/uploads/system-logo.png?v=1710000000000",
  "logoDarkUrl": "http://localhost:3000/uploads/system-logo-dark.png?v=1710000000000",
  "themePalette": { "...": "..." },
  "updatedAt": "..."
}
```

O `?v=` é cache-bust (`updatedAt`). Use a URL **exatamente** como veio da API.

---

## Pedido

Ajustar a tela de configurações / branding e o uso da logo no app (sidebar, login, etc.) para dark mode.

### 1. Upload dark deve ir para o endpoint certo

- Logo **clara** → `POST /configuracoes/logo` (multipart, field `logo`)
- Logo **escura** → `POST /configuracoes/logo-dark` (multipart, field `logo`)
- **Não** enviar o arquivo dark em `POST /configuracoes/logo`
- **Não** gravar dark só com `PUT /configuracoes` passando blob/base64 local — use o upload

### 2. Exibir a logo correta por tema

- Tema **light** → usar `logoUrl`
- Tema **dark** → usar `logoDarkUrl` quando existir; se `logoDarkUrl` for `null`, fallback para `logoUrl` (ou placeholder do produto — **não** forçar asset estático LINQ se a API já tiver logo)
- Remover qualquer hardcode de logo LINQ fixa no dark mode quando `logoDarkUrl` estiver preenchido

### 3. Após salvar, atualizar o estado com a resposta

Depois do upload (light ou dark), aplicar no state/store os campos da resposta (`logoUrl`, `logoDarkUrl`, `updatedAt`, `themePalette`).  
Não manter preview local antigo sobrescrevendo a URL da API.

### 4. Cache / preview

- Usar a URL retornada (já vem com `?v=`)
- Se houver `<img>` com src antigo, forçar re-render após upload
- Em dark mode, o preview da seção “Logo dark” deve mostrar `logoDarkUrl`, não `logoUrl`

### 5. PUT de configurações

Se o formulário salva tema + logos juntos:

- Ao salvar só paleta/horário/rodapé, **não** envie `logoUrl` / `logoDarkUrl` a menos que o usuário tenha alterado esses campos
- Se enviar `logoDarkUrl: null` por acidente, o backend **limpa** a logo dark

### 6. Checklist de teste

- [ ] Upload logo light → aparece no tema claro; dark inalterado
- [ ] Upload logo dark → aparece no tema escuro; light inalterado
- [ ] Recarregar a página em dark mode → continua a logo dark (não volta LINQ)
- [ ] Trocar tema light ↔ dark → logos corretas
- [ ] `logoDarkUrl` null → fallback documentado (logo light ou placeholder)

---

## Referência backend

- Rotas: `src/routes/configuracoes.routes.ts`
- Controller: `src/controllers/configuracao.controller.ts`
- Arquivos: `system-logo.*` vs `system-logo-dark.*` em `src/lib/logo-upload.ts`
