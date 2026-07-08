# Prompt — Frontend: Modalidade de Serviço só Local / Remoto

Cole este prompt no agente/chat do repositório **frontend** junto com o ajuste do contato.

---

## Contexto

O backend passou a aceitar e persistir somente:

- `local`
- `remoto`

Valores legados (`"Contrato - local"`, `"Sem contrato - remoto"`, etc.) ainda são **normalizados** no create/update, mas o valor canônico gravado/retornado é `local` | `remoto`.

Contrato ativo **não** entra mais na label da modalidade — vem do cadastro do cliente (PDF mostra N° contrato separado).

## Pedido

1. Na aba/campo **Modalidade de Serviço** do relatório, exibir **apenas** duas opções: **Local** e **Remoto**.
2. Remover textos/menus **"Com contrato" / "Sem contrato"** (e combinações).
3. Ao criar/editar, enviar no body:
   - `modalidadeServico: "local"` ou `"remoto"`
   - (ou alias `modalidade` com o mesmo valor)
4. Ao carregar relatório antigo que ainda venha com label longa (cache/API legada), mapear para Local/Remoto na UI (substring `local`/`remoto`).
5. Não pedir nem validar contrato nessa tela — contrato continua no cadastro do cliente.

## Critérios de aceite

- [ ] UI mostra só Local / Remoto.
- [ ] Payload usa `"local"` | `"remoto"`.
- [ ] Relatório existente com valor antigo abre com a opção correta selecionada.
- [ ] Create/update com sucesso (sem erro 400 de modalidade).
