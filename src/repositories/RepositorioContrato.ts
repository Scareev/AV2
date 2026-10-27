import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../infra/database/prisma.js";
import ErroAplicacao from "../errors/ErroAplicacao.js";

export default class RepositorioContrato {
  criar(dados: Prisma.ContratoCreateInput) {
    return prisma.contrato.create({ data: dados, include: { organizacao: true } });
  }

  buscarPorOrganizacao(organizacaoId: string) {
    return prisma.contrato.findUnique({ where: { organizacaoId }, include: { organizacao: true } });
  }

  listarPorOrganizacao(organizacaoId: string) {
    return prisma.contrato.findMany({ where: { organizacaoId }, include: { organizacao: true } });
  }

  async atualizar(id: string, version: number, dados: Prisma.ContratoUpdateInput) {
    const resultado = await prisma.contrato.updateMany({
      where: { id, version, encerradoEm: null },
      data: { ...dados, version: { increment: 1 } }
    });
    if (resultado.count !== 1) throw new ErroAplicacao("O contrato foi alterado desde a leitura. Recarregue os dados e tente novamente.", 409);
    return prisma.contrato.findUniqueOrThrow({ where: { id }, include: { organizacao: true } });
  }

  async encerrar(id: string, version: number, motivo: string) {
    const resultado = await prisma.contrato.updateMany({
      where: { id, version, encerradoEm: null },
      data: {
        encerradoEm: new Date(),
        motivoEncerramento: motivo,
        version: { increment: 1 }
      }
    });
    if (resultado.count !== 1) throw new ErroAplicacao("O contrato foi alterado ou encerrado desde a leitura. Recarregue os dados e tente novamente.", 409);
    return prisma.contrato.findUniqueOrThrow({ where: { id }, include: { organizacao: true } });
  }
}
