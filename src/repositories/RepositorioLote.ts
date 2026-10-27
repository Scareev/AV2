import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../infra/database/prisma.js";
import ErroAplicacao from "../errors/ErroAplicacao.js";

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

  listarPorPeriodo(dataInicio: Date, dataFim: Date, incluirCancelados = false) {
    return prisma.lote.findMany({
      where: {
        dataEntrada: { gte: dataInicio, lte: dataFim },
        ...(incluirCancelados ? {} : { canceladoEm: null })
      },
      include: { equipamentos: true },
      orderBy: { dataEntrada: "desc" }
    });
  }

  adicionarEquipamento(loteId: string, version: number, equipamento: Prisma.EquipamentoCreateWithoutLoteInput) {
    return prisma.$transaction(async tx => {
      const resultado = await tx.lote.updateMany({
        where: { id: loteId, version, canceladoEm: null },
        data: { version: { increment: 1 } }
      });
      if (resultado.count !== 1) {
        const existe = await tx.lote.findUnique({ where: { id: loteId }, select: { id: true } });
        if (!existe) throw new ErroAplicacao("Lote não encontrado.", 404);
        throw new ErroAplicacao("O lote foi alterado desde a leitura. Recarregue os dados e tente novamente.", 409);
      }
      return tx.equipamento.create({
        data: { ...equipamento, lote: { connect: { id: loteId } } }
      });
    });
  }

  async atualizar(id: string, version: number, dados: Prisma.LoteUpdateInput) {
    const resultado = await prisma.lote.updateMany({
      where: { id, version, canceladoEm: null },
      data: { ...dados, version: { increment: 1 } }
    });
    if (resultado.count !== 1) throw new ErroAplicacao("O lote foi alterado desde a leitura. Recarregue os dados e tente novamente.", 409);
    return prisma.lote.findUniqueOrThrow({ where: { id }, include: { equipamentos: true } });
  }

  async cancelar(id: string, version: number, motivo: string) {
    return prisma.$transaction(async tx => {
      const canceladoEm = new Date();
      const lote = await tx.lote.updateMany({
        where: { id, version, canceladoEm: null },
        data: {
          canceladoEm,
          motivoCancelamento: motivo,
          version: { increment: 1 }
        }
      });
      if (lote.count !== 1) {
        const existe = await tx.lote.findUnique({ where: { id }, select: { id: true } });
        if (!existe) throw new ErroAplicacao("Lote não encontrado.", 404);
        throw new ErroAplicacao("O lote foi alterado ou cancelado desde a leitura. Recarregue os dados e tente novamente.", 409);
      }
      await tx.equipamento.updateMany({
        where: { loteId: id, canceladoEm: null },
        data: {
          canceladoEm,
          motivoCancelamento: motivo,
          version: { increment: 1 }
        }
      });
    }, { isolationLevel: "Serializable" });
  }
}
