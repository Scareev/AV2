import ErroAplicacao from "../errors/ErroAplicacao.js";
import type { Prisma } from "../generated/prisma/client.js";
import Organizacao from "../domain/Organizacao.js";
import Contrato from "../domain/Contrato.js";
import RepositorioOrganizacao from "../repositories/RepositorioOrganizacao.js";
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

export default class ServicoOrganizacao {
  constructor(
    private readonly repositorio = new RepositorioOrganizacao(),
    private readonly validadorCNPJ = new ValidadorCNPJ()
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

    const registro = await this.repositorio.atualizar(id, {
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

  async desativarOrganizacao(id: string): Promise<void> {
    await this.repositorio.atualizar(id, { ativo: false });
  }

  async renovarContrato(organizacaoId: string, novoVencimento: Date): Promise<void> {
    const contrato = await this.repositorio.buscarContrato(organizacaoId);
    if (!contrato) {
      const organizacao = await this.repositorio.buscarPorId(organizacaoId);
      if (!organizacao) throw new ErroAplicacao("Organização não encontrada.", 404);
      throw new ErroAplicacao("A organização não possui contrato vigente.");
    }
    await this.repositorio.atualizarContrato(contrato.id, { dataVencimento: novoVencimento });
  }

  private criarOrganizacao(registro: OrganizacaoComContrato): Organizacao {
    const contrato = registro.contratoVigente
      ? new Contrato(
          registro.contratoVigente.id,
          registro.contratoVigente.organizacaoId,
          registro.contratoVigente.dataAssinatura,
          registro.contratoVigente.dataVencimento,
          registro.contratoVigente.clausulas,
          Number(registro.contratoVigente.valorMensal),
          registro.contratoVigente.renovacaoAutomatica
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
      contrato
    );
  }
}
