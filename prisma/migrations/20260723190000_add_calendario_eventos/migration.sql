-- CreateTable
CREATE TABLE "calendario_eventos" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "descricao" TEXT,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3) NOT NULL,
    "cliente_id" INTEGER,
    "criado_por_id" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendario_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendario_eventos_data_inicio_data_fim_idx" ON "calendario_eventos"("data_inicio", "data_fim");

-- CreateIndex
CREATE INDEX "calendario_eventos_criado_por_id_idx" ON "calendario_eventos"("criado_por_id");

-- CreateIndex
CREATE INDEX "calendario_eventos_cliente_id_idx" ON "calendario_eventos"("cliente_id");

-- AddForeignKey
ALTER TABLE "calendario_eventos" ADD CONSTRAINT "calendario_eventos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendario_eventos" ADD CONSTRAINT "calendario_eventos_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
