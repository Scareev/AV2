CREATE TYPE "TipoEventoMovimentacao" AS ENUM ('REGISTRO', 'CORRECAO', 'ESTORNO');

ALTER TABLE "Movimentacao"
ADD COLUMN "tipoEvento" "TipoEventoMovimentacao" NOT NULL DEFAULT 'REGISTRO',
ADD COLUMN "movimentacaoOrigemId" UUID;

ALTER TABLE "Movimentacao"
ADD CONSTRAINT "Movimentacao_movimentacaoOrigemId_fkey"
FOREIGN KEY ("movimentacaoOrigemId") REFERENCES "Movimentacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Movimentacao_movimentacaoOrigemId_idx" ON "Movimentacao"("movimentacaoOrigemId");
