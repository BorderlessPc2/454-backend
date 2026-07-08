-- ActivityAction: tentativas de login sem sucesso
ALTER TYPE "ActivityAction" ADD VALUE 'LOGIN_FAILED';

-- Permite auditoria de login falho sem usuário resolvido (credencial inexistente)
ALTER TABLE "system_activity_logs" DROP CONSTRAINT IF EXISTS "system_activity_logs_usuario_id_fkey";
ALTER TABLE "system_activity_logs" ALTER COLUMN "usuario_id" DROP NOT NULL;
ALTER TABLE "system_activity_logs"
  ADD CONSTRAINT "system_activity_logs_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Modalidade de serviço: apenas local | remoto (contrato vem do cadastro do cliente)
UPDATE "relatorios"
SET "modalidade_servico" = 'local'
WHERE "modalidade_servico" ILIKE '%local%';

UPDATE "relatorios"
SET "modalidade_servico" = 'remoto'
WHERE "modalidade_servico" ILIKE '%remoto%';
