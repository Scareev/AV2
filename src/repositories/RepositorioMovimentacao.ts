import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../infra/database/prisma.js";

export default class RepositorioMovimentacao {
  criar(dados: Prisma.MovimentacaoCreateInput) {
    return prisma.movimentacao.create({ data: dados, include: { equipamento: true } });
  }

  listarPorEquipamento(equipamentoId: string) {
    return prisma.movimentacao.findMany({
      where: { equipamentoId },
      orderBy: { dataHora: "asc" }
    });
  }
}
