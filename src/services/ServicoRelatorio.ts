import ErroAplicacao from "../errors/ErroAplicacao.js";
import RepositorioRelatorio from "../repositories/RepositorioRelatorio.js";
import type { StatusRastreamento as StatusRastreamentoDb } from "../generated/prisma/client.js";

export default class ServicoRelatorio {
  constructor(private readonly repositorio = new RepositorioRelatorio()) {}

  async gerarRelatorioPorOrganizacao(
    organizacaoId: string,
    periodo: { inicio: Date; fim: Date }
  ) {
    if (periodo.inicio > periodo.fim) throw new ErroAplicacao("O início do período deve ser anterior ao fim.");
    const lotes = await this.repositorio.listarLotesPorOrganizacao(organizacaoId, periodo.inicio, periodo.fim);
    return { organizacaoId, totalLotes: lotes.length, lotes };
  }

  async gerarRelatorioPorStatus(nomeStatus: StatusRastreamentoDb) {
    const equipamentos = await this.repositorio.listarEquipamentosPorStatus(nomeStatus);
    return { status: nomeStatus, totalEquipamentos: equipamentos.length, equipamentos };
  }

  async gerarRelatorioFinanceiro(periodo: { inicio: Date; fim: Date }) {
    if (periodo.inicio > periodo.fim) throw new ErroAplicacao("O início do período deve ser anterior ao fim.");
    const organizacoes = await this.repositorio.listarOrganizacoesComContrato(periodo.inicio, periodo.fim);
    const contratos = organizacoes.map(organizacao => ({
      organizacaoId: organizacao.id,
      razaoSocial: organizacao.razaoSocial,
      valorMensal: organizacao.contratoVigente && !organizacao.contratoVigente.encerradoEm
        ? Number(organizacao.contratoVigente.valorMensal)
        : 0
    }));
    const totalMensal = contratos.reduce((total, contrato) => total + contrato.valorMensal, 0);
    return { totalMensal, contratos };
  }
}
