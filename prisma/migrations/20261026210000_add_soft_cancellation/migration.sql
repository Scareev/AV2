ALTER TABLE "Contrato" ADD COLUMN "encerradoEm" TIMESTAMP(3);
ALTER TABLE "Contrato" ADD COLUMN "motivoEncerramento" TEXT;
ALTER TABLE "Lote" ADD COLUMN "canceladoEm" TIMESTAMP(3);
ALTER TABLE "Lote" ADD COLUMN "motivoCancelamento" TEXT;
ALTER TABLE "Equipamento" ADD COLUMN "canceladoEm" TIMESTAMP(3);
ALTER TABLE "Equipamento" ADD COLUMN "motivoCancelamento" TEXT;
