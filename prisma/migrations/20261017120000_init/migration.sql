-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoEquipamento" AS ENUM ('COMPUTADOR_MESA', 'NOTEBOOK', 'MONITOR', 'IMPRESSORA', 'SERVIDOR', 'ROTEADOR', 'CABO_ESTRUTURADO', 'FONTE_ALIMENTACAO');

-- CreateEnum
CREATE TYPE "EstadoFisico" AS ENUM ('NOVO', 'BOM_ESTADO', 'USADO_LEVE', 'USADO_MODERADO', 'DANIFICADO_LEVE', 'DANIFICADO_GRAVE', 'INSERVIVEL');

-- CreateEnum
CREATE TYPE "StatusRastreamento" AS ENUM ('AGUARDANDO_TRIAGEM', 'EM_TRIAGEM', 'AGUARDANDO_DESMONTE', 'EM_DESMONTE', 'PECAS_REAPROVEITADAS', 'MATERIAL_RECICLAVEL', 'DESCARTE_SEGURO', 'BAIXA_DEFINITIVA');

-- CreateEnum
CREATE TYPE "StatusLote" AS ENUM ('RECEBIDO', 'EM_TRIAGEM', 'TRIAGEM_CONCLUIDA', 'ENCAMINHADO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('ADMINISTRADOR', 'OPERADOR_CADASTRO', 'GESTOR_ALMOXARIFADO', 'AUDITOR');

-- CreateTable
CREATE TABLE "Organizacao" (
    "id" UUID NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "inscricaoEstadual" TEXT NOT NULL,
    "enderecoCompleto" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dataCadastro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Organizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contrato" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "dataAssinatura" TIMESTAMP(3) NOT NULL,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "clausulas" TEXT[],
    "valorMensal" DECIMAL(12,2) NOT NULL,
    "renovacaoAutomatica" BOOLEAN NOT NULL,

    CONSTRAINT "Contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" UUID NOT NULL,
    "dataEntrada" TIMESTAMP(3) NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "notaFiscal" TEXT NOT NULL,
    "transportadora" TEXT NOT NULL,
    "statusProcessamento" "StatusLote" NOT NULL DEFAULT 'RECEBIDO',
    "observacoes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipamento" (
    "id" UUID NOT NULL,
    "codigoBarrasInterno" TEXT NOT NULL,
    "tipo" "TipoEquipamento" NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "anoFabricacao" INTEGER NOT NULL,
    "estadoFisico" "EstadoFisico" NOT NULL,
    "pesoQuilogramas" DECIMAL(10,3) NOT NULL,
    "loteId" UUID NOT NULL,
    "posicaoNoLote" INTEGER NOT NULL,
    "statusRastreamento" "StatusRastreamento" NOT NULL DEFAULT 'AGUARDANDO_TRIAGEM',

    CONSTRAINT "Equipamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimentacao" (
    "id" UUID NOT NULL,
    "equipamentoId" UUID NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origem" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "responsavel" TEXT NOT NULL,
    "observacao" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Movimentacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credencial" (
    "id" UUID NOT NULL,
    "usuario" TEXT NOT NULL,
    "hashSenha" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "ultimoAcesso" TIMESTAMP(3),
    "papel" "PapelUsuario" NOT NULL DEFAULT 'OPERADOR_CADASTRO',

    CONSTRAINT "Credencial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organizacao_cnpj_key" ON "Organizacao"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Contrato_organizacaoId_key" ON "Contrato"("organizacaoId");

-- CreateIndex
CREATE INDEX "Lote_organizacaoId_dataEntrada_idx" ON "Lote"("organizacaoId", "dataEntrada");

-- CreateIndex
CREATE UNIQUE INDEX "Equipamento_codigoBarrasInterno_key" ON "Equipamento"("codigoBarrasInterno");

-- CreateIndex
CREATE INDEX "Equipamento_loteId_posicaoNoLote_idx" ON "Equipamento"("loteId", "posicaoNoLote");

-- CreateIndex
CREATE INDEX "Movimentacao_equipamentoId_dataHora_idx" ON "Movimentacao"("equipamentoId", "dataHora");

-- CreateIndex
CREATE UNIQUE INDEX "Credencial_usuario_key" ON "Credencial"("usuario");

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipamento" ADD CONSTRAINT "Equipamento_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "Equipamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
