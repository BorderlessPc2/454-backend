# Prompt — Frontend: Contato do cliente sem editar Função/Cargo

Cole este prompt no agente/chat do repositório **frontend** para ajustar a UI do relatório.

---

## Contexto

No formulário de relatório (criar/editar), ao escolher o **Contato do cliente**, a UI ainda mostra/edita o campo **Função/Cargo**.

Isso não deve mais acontecer. Cargo/função é dado consolidado no **cadastro do cliente → contatos**. Ninguém deve alterar esse texto pelo fluxo do relatório.

O backend já:

- Aceita apenas `contatoId` no create/update de relatório (sem campo de cargo no payload do relatório).
- Resolve o cargo do contato cadastrado na hora do PDF (`contato.cargo`).
- Mantém CRUD de `cargo` apenas nas rotas de contatos do cliente (`PUT /clientes/:id/contatos/:contatoId`, etc.).

## Pedido

1. Na tela de **criar/editar relatório**, no seletor/seção de Contato:
   - Manter apenas a escolha do contato (nome / lista).
   - **Remover** o input/menu/campo **Função/Cargo** (não renderizar, não permitir edição).
2. Se hoje o front preenche `cargo` em state local ao selecionar o contato e/ou envia no body do relatório, **parar** de fazer isso.
3. Se a UI mostrava cargo só como leitura ao lado do contato, preferência do produto: **também remover** da tela do relatório (fica só no cadastro do cliente e no PDF).
4. **Não** remover o campo cargo das telas de **cadastro/edição de cliente → contatos** — só do fluxo do relatório.
5. Garantir que o select de contato continue enviando apenas `contatoId` (number) para `POST/PUT /relatorios`.

## Critérios de aceite

- [ ] Abrir create relatório → escolher contato → **não** existe campo Função/Cargo editável.
- [ ] Abrir edit relatório com contato preenchido → **não** existe campo Função/Cargo editável.
- [ ] Payload de create/update **não** inclui `cargo` / `contatoCargo` / similares.
- [ ] Cadastro de cliente ainda permite ver/editar cargo do contato.
- [ ] PDF continua mostrando cargo do contato cadastrado (sem mudança necessária no front, se o PDF vier do backend).

## Fora de escopo

- Não alterar modalidade de serviço neste prompt (já tratado no backend como `local` | `remoto`).
- Não alterar auditoria de login.
