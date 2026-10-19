import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../infra/database/prisma.js";

export default class RepositorioOrganizacao {
  criar(dados: Prisma.OrganizacaoCreateInput) {
    return prisma.organizacao.create({ data: dados, include: { contratoVigente: true } });
  }

  buscarPorId(id: string) {
    return prisma.organizacao.findUnique({ where: { id }, include: { contratoVigente: true } });
  }

  buscarPorCnpj(cnpj: string) {
    return prisma.organizacao.findUnique({ where: { cnpj }, include: { contratoVigente: true } });
  }

  listarAtivas() {
    return prisma.organizacao.findMany({
      where: { ativo: true },
      include: { contratoVigente: true },
      orderBy: { razaoSocial: "asc" }
    });
  }

  buscarContrato(organizacaoId: string) {
    return prisma.contrato.findUnique({ where: { organizacaoId } });
  }

  atualizarContrato(id: string, dados: Prisma.ContratoUpdateInput) {
    return prisma.contrato.update({ where: { id }, data: dados });
  }

  atualizar(id: string, dados: Prisma.OrganizacaoUpdateInput) {
    return prisma.organizacao.update({ where: { id }, data: dados, include: { contratoVigente: true } });
  }
}
