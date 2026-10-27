import ErroAplicacao from "../errors/ErroAplicacao.js";
import type { Prisma } from "../generated/prisma/client.js";
import Organizacao from "../domain/Organizacao.js";
import Contrato from "../domain/Contrato.js";
import RepositorioOrganizacao from "../repositories/RepositorioOrganizacao.js";
import RepositorioContrato from "../repositories/RepositorioContrato.js";
import ValidadorCNPJ from "../infra/validadores/ValidadorCNPJ.js";

type OrganizacaoComContrato = Prisma.OrganizacaoGetPayload<{ include: { contratoVigente: true } }>;

interface DadosOrganizacao {
  id?: string;
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual?: string;
  enderecoCompleto: string;
  telefone: string;
  email: string;
  dataCadastro?: Date;
  ativo?: boolean;
  contratoVigente?: {
    dataAssinatura: Date;
    dataVencimento: Date;
    clausulas: string[];
    valorMensal: number;
    renovacaoAutomatica: boolean;
  } | null;
}

interface DadosContrato {
  dataAssinatura: Date;
  dataVencimento: Date;
  clausulas: string[];
  valorMensal: number;
  renovacaoAutomatica: boolean;
}

export default class ServicoOrganizacao {
  constructor(
    private readonly repositorio = new RepositorioOrganizacao(),
    private readonly validadorCNPJ = new ValidadorCNPJ(),
    private readonly repositorioContrato = new RepositorioContrato()
  ) {}

  async cadastrarOrganizacao(dados: DadosOrganizacao): Promise<Organizacao> {
    if (!this.validadorCNPJ.validar(dados.cnpj)) {
      throw new ErroAplicacao(this.validadorCNPJ.obterMensagemErro());
    }

    const cnpj = dados.cnpj.replace(/\D/g, "");
    if (await this.repositorio.buscarPorCnpj(cnpj)) {
      throw new ErroAplicacao("O CNPJ informado já está cadastrado.", 409);
    }

    const data: Prisma.OrganizacaoCreateInput = {
      ...(dados.id ? { id: dados.id } : {}),
      razaoSocial: dados.razaoSocial.trim(),
      cnpj,
      inscricaoEstadual: dados.inscricaoEstadual ?? "",
      enderecoCompleto: dados.enderecoCompleto,
      telefone: dados.telefone,
      email: dados.email,
      ...(dados.dataCadastro ? { dataCadastro: dados.dataCadastro } : {}),
      ativo: dados.ativo ?? true,
      ...(dados.contratoVigente ? {
        contratoVigente: {
          create: {
            dataAssinatura: dados.contratoVigente.dataAssinatura,
            dataVencimento: dados.contratoVigente.dataVencimento,
            clausulas: dados.contratoVigente.clausulas,
            valorMensal: dados.contratoVigente.valorMensal,
            renovacaoAutomatica: dados.contratoVigente.renovacaoAutomatica
          }
        }
      } : {})
    };

    try {
      return this.criarOrganizacao(await this.repositorio.criar(data));
    } catch (erro) {
      if (typeof erro === "object" && erro !== null && "code" in erro && erro.code === "P2002") {
        throw new ErroAplicacao("O CNPJ informado já está cadastrado.", 409);
      }
      throw erro;
    }
  }

  async buscarOrganizacao(id: string): Promise<Organizacao> {
    const registro = await this.repositorio.buscarPorId(id);
    if (!registro) throw new ErroAplicacao("Organização não encontrada.", 404);
    return this.criarOrganizacao(registro);
  }

  async listarOrganizacoesAtivas(): Promise<Organizacao[]> {
    const registros = await this.repositorio.listarAtivas();
    return registros.map(registro => this.criarOrganizacao(registro));
  }

  async atualizarOrganizacao(
    id: string,
    version: number,
    dados: Partial<Omit<DadosOrganizacao, "id" | "contratoVigente" | "dataCadastro">>
  ): Promise<Organizacao> {
    if (dados.cnpj !== undefined) {
      if (!this.validadorCNPJ.validar(dados.cnpj)) {
        throw new ErroAplicacao(this.validadorCNPJ.obterMensagemErro());
      }
      const cnpj = dados.cnpj.replace(/\D/g, "");
      const existente = await this.repositorio.buscarPorCnpj(cnpj);
      if (existente && existente.id !== id) throw new ErroAplicacao("O CNPJ informado já está cadastrado.", 409);
      dados = { ...dados, cnpj };
    }

    const registro = await this.repositorio.atualizar(id, version, {
      ...(dados.razaoSocial !== undefined ? { razaoSocial: dados.razaoSocial.trim() } : {}),
      ...(dados.cnpj !== undefined ? { cnpj: dados.cnpj } : {}),
      ...(dados.inscricaoEstadual !== undefined ? { inscricaoEstadual: dados.inscricaoEstadual } : {}),
      ...(dados.enderecoCompleto !== undefined ? { enderecoCompleto: dados.enderecoCompleto } : {}),
      ...(dados.telefone !== undefined ? { telefone: dados.telefone } : {}),
      ...(dados.email !== undefined ? { email: dados.email } : {}),
      ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {})
    });
    return this.criarOrganizacao(registro);
  }

  async desativarOrganizacao(id: string, version: number): Promise<void> {
    await this.repositorio.atualizar(id, version, { ativo: false });
  }

  async renovarContrato(organizacaoId: string, novoVencimento: Date, version: number): Promise<void> {
    const contrato = await this.repositorio.buscarContrato(organizacaoId);
    if (!contrato) {
      const organizacao = await this.repositorio.buscarPorId(organizacaoId);
      if (!organizacao) throw new ErroAplicacao("Organização não encontrada.", 404);
      throw new ErroAplicacao("A organização não possui contrato vigente.");
    }
    if (novoVencimento <= contrato.dataAssinatura) {
      throw new ErroAplicacao("O vencimento deve ser posterior à data de assinatura.");
    }
    await this.repositorio.atualizarContrato(contrato.id, version, { dataVencimento: novoVencimento });
  }

  async cadastrarContrato(organizacaoId: string, dados: DadosContrato) {
    const organizacao = await this.repositorio.buscarPorId(organizacaoId);
    if (!organizacao || !organizacao.ativo) throw new ErroAplicacao("Organização ativa não encontrada.", 404);
    if (await this.repositorio.buscarContrato(organizacaoId)) {
      throw new ErroAplicacao("A organização já possui um contrato registrado.", 409);
    }
    if (dados.dataAssinatura >= dados.dataVencimento) {
      throw new ErroAplicacao("A data de assinatura deve ser anterior ao vencimento.");
    }
    return this.repositorio.criarContrato(organizacaoId, dados);
  }

  async listarContratos(organizacaoId: string) {
    const organizacao = await this.repositorio.buscarPorId(organizacaoId);
    if (!organizacao) throw new ErroAplicacao("Organização não encontrada.", 404);
    return this.repositorioContrato.listarPorOrganizacao(organizacaoId);
  }

  async atualizarContrato(organizacaoId: string, contratoId: string, version: number, dados: Partial<DadosContrato>) {
    const contrato = await this.repositorioContrato.buscarPorOrganizacao(organizacaoId);
    if (!contrato || contrato.id !== contratoId) throw new ErroAplicacao("Contrato não encontrado para esta organização.", 404);
    if (contrato.encerradoEm) throw new ErroAplicacao("Não é permitido alterar um contrato encerrado.", 409);
    if (dados.dataAssinatura && dados.dataVencimento && dados.dataAssinatura >= dados.dataVencimento) {
      throw new ErroAplicacao("A data de assinatura deve ser anterior ao vencimento.");
    }
    const dataAssinatura = dados.dataAssinatura ?? contrato.dataAssinatura;
    const dataVencimento = dados.dataVencimento ?? contrato.dataVencimento;
    if (dataAssinatura >= dataVencimento) throw new ErroAplicacao("A data de assinatura deve ser anterior ao vencimento.");
    return this.repositorioContrato.atualizar(contratoId, version, dados);
  }

  async encerrarContrato(organizacaoId: string, contratoId: string, version: number, motivo: string) {
    if (!motivo.trim()) throw new ErroAplicacao("Informe o motivo do encerramento.");
    const contrato = await this.repositorioContrato.buscarPorOrganizacao(organizacaoId);
    if (!contrato || contrato.id !== contratoId) throw new ErroAplicacao("Contrato não encontrado para esta organização.", 404);
    return this.repositorioContrato.encerrar(contratoId, version, motivo.trim());
  }

  private criarOrganizacao(registro: OrganizacaoComContrato): Organizacao {
    const contrato = registro.contratoVigente && !registro.contratoVigente.encerradoEm
      ? new Contrato(
          registro.contratoVigente.id,
          registro.contratoVigente.organizacaoId,
          registro.contratoVigente.dataAssinatura,
          registro.contratoVigente.dataVencimento,
          registro.contratoVigente.clausulas,
          Number(registro.contratoVigente.valorMensal),
          registro.contratoVigente.renovacaoAutomatica,
          registro.contratoVigente.version,
          registro.contratoVigente.encerradoEm,
          registro.contratoVigente.motivoEncerramento
        )
      : null;

    return new Organizacao(
      registro.id,
      registro.razaoSocial,
      registro.cnpj,
      registro.inscricaoEstadual,
      registro.enderecoCompleto,
      registro.telefone,
      registro.email,
      registro.dataCadastro,
      registro.ativo,
      contrato,
      registro.version
    );
  }
}
