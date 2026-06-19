-- Persiste logo em base64 para geração de PDF sem depender do disco local.
ALTER TABLE "configuracoes" ADD COLUMN "logo_data_url" TEXT;
