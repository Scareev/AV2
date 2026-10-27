import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../infra/database/prisma.js";
import ErroAplicacao from "../errors/ErroAplicacao.js";

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

  criarContrato(organizacaoId: string, dados: Omit<Prisma.ContratoCreateInput, "organizacao">) {
    return prisma.contrato.create({
      data: { ...dados, organizacao: { connect: { id: organizacaoId } } },
      include: { organizacao: true }
    });
  }

  async atualizarContrato(id: string, version: number, dados: Prisma.ContratoUpdateInput) {
    const resultado = await prisma.contrato.updateMany({
      where: { id, version },
      data: { ...dados, version: { increment: 1 } }
    });
    if (resultado.count !== 1) throw new ErroAplicacao("O contrato foi alterado desde a leitura. Recarregue os dados e tente novamente.", 409);
    return prisma.contrato.findUniqueOrThrow({ where: { id } });
  }

  async atualizar(id: string, version: number, dados: Prisma.OrganizacaoUpdateInput) {
    const resultado = await prisma.organizacao.updateMany({
      where: { id, version },
      data: { ...dados, version: { increment: 1 } }
    });
    if (resultado.count !== 1) throw new ErroAplicacao("A organização foi alterada desde a leitura. Recarregue os dados e tente novamente.", 409);
    return prisma.organizacao.findUniqueOrThrow({ where: { id }, include: { contratoVigente: true } });
  }
}
