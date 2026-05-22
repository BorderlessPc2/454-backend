# Backup e Disaster Recovery (PostgreSQL / Render)

## Objetivo

Conseguir **restaurar** dados razoável após erro humano, bug com `DELETE`, ou falha severa na conta cloud.

## Backup manual (PostgreSQL → ficheiro)

Com cliente `pg_dump` instalado ou via container com a sua **External Database URL**:

```powershell
# PowerShell — não commite valores reais ao Git
$env:DATABASE_URL = "postgresql://..."
pg_dump "$env:DATABASE_URL" --no-owner --format=custom -f backup.dump
```

Para ambiente onde `pg_dump` não está instalado:

```bash
docker run --rm postgres:17-alpine pg_dump "$DATABASE_URL" --no-owner -Fc -o /backup.dump
```

**(Ajustar montagem `-v $(pwd)` para ler o `.dump` fora do container.)**

Melhor usar credenciais **apenas na máquina/cofre** — nunca gravar dumps reais dentro do repo.

## Restauração (conceito)

Para restaurar um dump customizado numa base vazia (ajustado ao teu comando real):

```text
pg_restore --clean --if-exists -d $DATABASE_URL backup.dump
```

## Limitações típicas (Render gratuito ou simples)

- Sem backup automático “one-click export” igual enterprise — a rotina acima deve ser **manual ou agendada** (cron em VM, CI com segredos, etc.).
- RTO/RPO negociados pela equipa: **com que frequência** faz dump e até que data aceita-se perda.

## O que não substitui

- Esta documentação não ativa cópias na Render por si — só formaliza procedimento esperado pela equipa de operações.
