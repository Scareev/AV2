import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../infra/database/prisma.js";

export default class RepositorioContrato {
  criar(dados: Prisma.ContratoCreateInput) {
    return prisma.contrato.create({ data: dados, include: { organizacao: true } });
  }

  buscarPorOrganizacao(organizacaoId: string) {
    return prisma.contrato.findUnique({ where: { organizacaoId }, include: { organizacao: true } });
  }

  atualizar(id: string, dados: Prisma.ContratoUpdateInput) {
    return prisma.contrato.update({ where: { id }, data: dados, include: { organizacao: true } });
  }
}
