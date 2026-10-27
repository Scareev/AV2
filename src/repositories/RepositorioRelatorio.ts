import type { StatusRastreamento } from "../generated/prisma/client.js";
import { prisma } from "../infra/database/prisma.js";

export default class RepositorioRelatorio {
  listarLotesPorOrganizacao(organizacaoId: string, inicio: Date, fim: Date) {
    return prisma.lote.findMany({
      where: { organizacaoId, dataEntrada: { gte: inicio, lte: fim }, canceladoEm: null },
      include: { equipamentos: { where: { canceladoEm: null } } },
      orderBy: { dataEntrada: "asc" }
    });
  }

  listarEquipamentosPorStatus(statusRastreamento: StatusRastreamento) {
    return prisma.equipamento.findMany({
      where: { statusRastreamento, canceladoEm: null, lote: { is: { canceladoEm: null } } },
      include: { historicoMovimentacao: { orderBy: { dataHora: "asc" } }, lote: true },
      orderBy: { codigoBarrasInterno: "asc" }
    });
  }

  listarOrganizacoesComContrato(inicio: Date, fim: Date) {
    return prisma.organizacao.findMany({
      where: { dataCadastro: { gte: inicio, lte: fim }, ativo: true },
      include: { contratoVigente: true },
      orderBy: { razaoSocial: "asc" }
    });
  }
}
