/*
  Warnings:

  - You are about to drop the column `created_at` on the `audit_logs` table. All the data in the column will be lost.
  - Changed the type of `acao` on the `audit_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- DropIndex
DROP INDEX "audit_logs_created_at_idx";

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "created_at",
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "acao",
ADD COLUMN     "acao" "AuditAction" NOT NULL;

-- DropEnum
DROP TYPE "AuditLogAcao";

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "relatorios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
