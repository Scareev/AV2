import ErroAplicacao from "../errors/ErroAplicacao.js";
import type {
  EstadoFisico,
  Prisma,
  StatusRastreamento
} from "../generated/prisma/client.js";
import { StatusRastreamento as Status } from "../generated/prisma/enums.js";
import { prisma } from "../infra/database/prisma.js";

export default class RepositorioEquipamento {
  criar(dados: Prisma.EquipamentoCreateInput) {
    return prisma.equipamento.create({ data: dados, include: { historicoMovimentacao: true } });
  }

  listar() {
    return prisma.equipamento.findMany({
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

  listarPorStatus(statusRastreamento: StatusRastreamento) {
    return prisma.equipamento.findMany({
      where: { statusRastreamento },
      include: { historicoMovimentacao: { orderBy: { dataHora: "asc" } }, lote: true },
      orderBy: { codigoBarrasInterno: "asc" }
    });
  }

  atualizar(id: string, dados: Prisma.EquipamentoUpdateInput) {
    return prisma.equipamento.update({ where: { id }, data: dados });
  }

  registrarMovimentacao(dados: Prisma.MovimentacaoCreateInput) {
    return prisma.movimentacao.create({ data: dados });
  }

  atualizarEstadoComMovimentacao(dados: {
    id: string;
    estadoAtual: EstadoFisico;
    estadoNovo: EstadoFisico;
    responsavel: string;
    observacao: string;
  }) {
    return prisma.$transaction(async tx => {
      const resultado = await tx.equipamento.updateMany({
        where: { id: dados.id, estadoFisico: dados.estadoAtual },
        data: { estadoFisico: dados.estadoNovo }
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
    statusAtual: StatusRastreamento;
    responsavel: string;
  }) {
    return prisma.$transaction(async tx => {
      const resultado = await tx.equipamento.updateMany({
        where: { id: dados.id, statusRastreamento: dados.statusAtual },
        data: { statusRastreamento: Status.AGUARDANDO_DESMONTE }
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
}
