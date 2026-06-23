-- CreateEnum
CREATE TYPE "RelatorioStatus" AS ENUM ('AGENDADO', 'FINALIZADO', 'CANCELADO');

-- AlterTable
ALTER TABLE "contratos" ADD COLUMN "visitas_mensais_esperadas" INTEGER;

-- AlterTable
ALTER TABLE "relatorios" ADD COLUMN "status" "RelatorioStatus" NOT NULL DEFAULT 'FINALIZADO';
