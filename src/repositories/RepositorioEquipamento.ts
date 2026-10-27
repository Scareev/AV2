import ErroAplicacao from "../errors/ErroAplicacao.js";
import type {
  EstadoFisico,
  Prisma,
  StatusRastreamento,
  TipoEventoMovimentacao
} from "../generated/prisma/client.js";
import { StatusRastreamento as Status } from "../generated/prisma/enums.js";
import { prisma } from "../infra/database/prisma.js";

export default class RepositorioEquipamento {
  async criar(loteId: string, versionLote: number, dados: Prisma.EquipamentoCreateInput) {
    return prisma.$transaction(async tx => {
      const loteAtualizado = await tx.lote.updateMany({
        where: { id: loteId, version: versionLote, canceladoEm: null },
        data: { version: { increment: 1 } }
      });
      if (loteAtualizado.count !== 1) {
        const existe = await tx.lote.findUnique({ where: { id: loteId }, select: { id: true } });
        if (!existe) throw new ErroAplicacao("Lote não encontrado.", 404);
        throw new ErroAplicacao("O lote foi alterado desde a leitura. Recarregue os dados e tente novamente.", 409);
      }
      return tx.equipamento.create({ data: dados, include: { historicoMovimentacao: true } });
    });
  }

  listar(incluirCancelados = false) {
    return prisma.equipamento.findMany({
      ...(incluirCancelados ? {} : { where: { canceladoEm: null, lote: { is: { canceladoEm: null } } } }),
      include: { historicoMovimentacao: { orderBy: { dataHora: "asc" } } },
      orderBy: { codigoBarrasInterno: "asc" }
    });
  }

  buscarPorId(id: string) {
    return prisma.equipamento.findUnique({
      where: { id },
      include: { historicoMovimentacao: { orderBy: { dataHora: "asc" } } }
    });
  }

  buscarPorCodigoBarras(codigoBarrasInterno: string) {
    return prisma.equipamento.findUnique({ where: { codigoBarrasInterno } });
  }

  listarPorStatus(statusRastreamento: StatusRastreamento, incluirCancelados = false) {
    return prisma.equipamento.findMany({
      where: {
        statusRastreamento,
        ...(incluirCancelados ? {} : { canceladoEm: null, lote: { is: { canceladoEm: null } } })
      },
      include: { historicoMovimentacao: { orderBy: { dataHora: "asc" } }, lote: true },
      orderBy: { codigoBarrasInterno: "asc" }
    });
  }

  async atualizar(id: string, version: number, dados: Prisma.EquipamentoUpdateInput) {
    const resultado = await prisma.equipamento.updateMany({
      where: { id, version, canceladoEm: null, lote: { is: { canceladoEm: null } } },
      data: { ...dados, version: { increment: 1 } }
    });
    if (resultado.count !== 1) throw new ErroAplicacao("O equipamento foi alterado desde a leitura. Recarregue os dados e tente novamente.", 409);
    return prisma.equipamento.findUniqueOrThrow({ where: { id } });
  }

  async registrarMovimentacao(equipamentoId: string, version: number, dados: Prisma.MovimentacaoCreateInput) {
    return prisma.$transaction(async tx => {
      const resultado = await tx.equipamento.updateMany({
        where: { id: equipamentoId, version, canceladoEm: null, lote: { is: { canceladoEm: null } } },
        data: { version: { increment: 1 } }
      });
      if (resultado.count !== 1) {
        const existe = await tx.equipamento.findUnique({ where: { id: equipamentoId }, select: { id: true } });
        if (!existe) throw new ErroAplicacao("Equipamento não encontrado.", 404);
        throw new ErroAplicacao("O equipamento foi alterado desde a leitura. Recarregue os dados e tente novamente.", 409);
      }
      return tx.movimentacao.create({ data: dados });
    });
  }

  async registrarEventoMovimentacao(dados: {
    equipamentoId: string;
    movimentacaoId: string;
    version: number;
    tipoEvento: TipoEventoMovimentacao;
    responsavel: string;
    justificativa: string;
    destinoCorrigido?: string;
  }) {
    return prisma.$transaction(async tx => {
      const original = await tx.movimentacao.findFirst({
        where: { id: dados.movimentacaoId, equipamentoId: dados.equipamentoId }
      });
      if (!original) throw new ErroAplicacao("Movimentação não encontrada para este equipamento.", 404);
      if (original.tipoEvento !== "REGISTRO") {
        throw new ErroAplicacao("Correções e estornos devem referenciar uma movimentação original.", 409);
      }
      const estorno = await tx.movimentacao.findFirst({
        where: { movimentacaoOrigemId: original.id, tipoEvento: "ESTORNO" },
        select: { id: true }
      });
      if (estorno) throw new ErroAplicacao("A movimentação já foi estornada e não pode receber novos eventos.", 409);

      const atualizacao = await tx.equipamento.updateMany({
        where: {
          id: dados.equipamentoId,
          version: dados.version,
          canceladoEm: null,
          lote: { is: { canceladoEm: null } }
        },
        data: { version: { increment: 1 } }
      });
      if (atualizacao.count !== 1) {
        const equipamento = await tx.equipamento.findUnique({ where: { id: dados.equipamentoId }, select: { id: true } });
        if (!equipamento) throw new ErroAplicacao("Equipamento não encontrado.", 404);
        throw new ErroAplicacao("O equipamento foi alterado desde a leitura. Recarregue os dados e tente novamente.", 409);
      }

      return tx.movimentacao.create({
        data: {
          equipamentoId: dados.equipamentoId,
          tipoEvento: dados.tipoEvento,
          movimentacaoOrigemId: original.id,
          origem: dados.tipoEvento === "CORRECAO" ? original.origem : original.destino,
          destino: dados.tipoEvento === "CORRECAO" ? dados.destinoCorrigido! : original.origem,
          responsavel: dados.responsavel,
          observacao: dados.justificativa
        }
      });
    });
  }

  atualizarEstadoComMovimentacao(dados: {
    id: string;
    version: number;
    estadoAtual: EstadoFisico;
    estadoNovo: EstadoFisico;
    responsavel: string;
    observacao: string;
  }) {
    return prisma.$transaction(async tx => {
      const resultado = await tx.equipamento.updateMany({
        where: { id: dados.id, version: dados.version, estadoFisico: dados.estadoAtual, canceladoEm: null, lote: { is: { canceladoEm: null } } },
        data: { estadoFisico: dados.estadoNovo, version: { increment: 1 } }
      });
      if (resultado.count !== 1) {
        throw new ErroAplicacao("O equipamento foi alterado por outra operação; recarregue os dados e tente novamente.", 409);
      }
      await tx.movimentacao.create({
        data: {
          equipamentoId: dados.id,
          origem: dados.estadoAtual,
          destino: dados.estadoNovo,
          responsavel: dados.responsavel,
          observacao: dados.observacao
        }
      });
      return tx.equipamento.findUniqueOrThrow({ where: { id: dados.id } });
    });
  }

  concluirTriagemComMovimentacao(dados: {
    id: string;
    version: number;
    statusAtual: StatusRastreamento;
    responsavel: string;
  }) {
    return prisma.$transaction(async tx => {
      const resultado = await tx.equipamento.updateMany({
        where: { id: dados.id, version: dados.version, statusRastreamento: dados.statusAtual, canceladoEm: null, lote: { is: { canceladoEm: null } } },
        data: { statusRastreamento: Status.AGUARDANDO_DESMONTE, version: { increment: 1 } }
      });
      if (resultado.count !== 1) {
        throw new ErroAplicacao("O equipamento foi alterado por outra operação; recarregue os dados e tente novamente.", 409);
      }
      await tx.movimentacao.create({
        data: {
          equipamentoId: dados.id,
          origem: dados.statusAtual,
          destino: Status.AGUARDANDO_DESMONTE,
          responsavel: dados.responsavel,
          observacao: "Triagem concluída"
        }
      });
    });
  }

  async cancelar(id: string, version: number, motivo: string) {
    const resultado = await prisma.equipamento.updateMany({
      where: { id, version, canceladoEm: null, lote: { is: { canceladoEm: null } } },
      data: {
        canceladoEm: new Date(),
        motivoCancelamento: motivo,
        version: { increment: 1 }
      }
    });
    if (resultado.count !== 1) throw new ErroAplicacao("O equipamento foi alterado ou cancelado desde a leitura. Recarregue os dados e tente novamente.", 409);
  }
}
