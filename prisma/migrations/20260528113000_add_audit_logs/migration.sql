-- Auditoria de alterações em relatórios
CREATE TYPE "AuditLogAcao" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

CREATE TABLE "audit_logs" (
  "id" SERIAL PRIMARY KEY,
  "relatorio_id" INTEGER NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "acao" "AuditLogAcao" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "audit_logs_relatorio_id_idx" ON "audit_logs"("relatorio_id");
CREATE INDEX "audit_logs_usuario_id_idx" ON "audit_logs"("usuario_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

