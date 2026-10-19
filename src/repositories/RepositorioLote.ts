import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../infra/database/prisma.js";

export default class RepositorioLote {
  criar(dados: Prisma.LoteCreateInput) {
    return prisma.lote.create({ data: dados, include: { equipamentos: true } });
  }

  buscarPorId(id: string) {
    return prisma.lote.findUnique({
      where: { id },
      include: { equipamentos: { orderBy: { posicaoNoLote: "asc" } } }
    });
  }

  listarPorPeriodo(dataInicio: Date, dataFim: Date) {
    return prisma.lote.findMany({
      where: { dataEntrada: { gte: dataInicio, lte: dataFim } },
      include: { equipamentos: true },
      orderBy: { dataEntrada: "desc" }
    });
  }

  adicionarEquipamento(loteId: string, equipamento: Prisma.EquipamentoCreateWithoutLoteInput) {
    return prisma.equipamento.create({
      data: { ...equipamento, lote: { connect: { id: loteId } } }
    });
  }

  atualizar(id: string, dados: Prisma.LoteUpdateInput) {
    return prisma.lote.update({ where: { id }, data: dados, include: { equipamentos: true } });
  }
}
