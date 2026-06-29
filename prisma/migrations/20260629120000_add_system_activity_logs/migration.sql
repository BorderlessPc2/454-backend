-- CreateEnum
CREATE TYPE "ActivityEntity" AS ENUM ('USER', 'CLIENTE', 'RELATORIO', 'CHECKLIST', 'SETOR', 'RAMO_ATIVIDADE', 'CONFIGURACAO', 'AUTH');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'RESET_PASSWORD', 'CHANGE_PASSWORD', 'UPLOAD');

-- CreateTable
CREATE TABLE "system_activity_logs" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "acao" "ActivityAction" NOT NULL,
    "entidade" "ActivityEntity" NOT NULL,
    "entidade_id" INTEGER,
    "descricao" VARCHAR(500),
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_activity_logs_usuario_id_idx" ON "system_activity_logs"("usuario_id");

-- CreateIndex
CREATE INDEX "system_activity_logs_entidade_idx" ON "system_activity_logs"("entidade");

-- CreateIndex
CREATE INDEX "system_activity_logs_entidade_id_idx" ON "system_activity_logs"("entidade_id");

-- CreateIndex
CREATE INDEX "system_activity_logs_timestamp_idx" ON "system_activity_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "system_activity_logs" ADD CONSTRAINT "system_activity_logs_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
