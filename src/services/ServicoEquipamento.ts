import ErroAplicacao from "../errors/ErroAplicacao.js";
import EstadoFisicoDominio from "../domain/enums/EstadoFisico.js";
import TipoEquipamentoDominio from "../domain/enums/TipoEquipamento.js";
import Movimentacao from "../domain/Movimentacao.js";
import { validarJustificativaAlteracaoEstadoFisico } from "../domain/regras/EstadoFisico.js";
import { StatusRastreamento as StatusRastreamentoDbEnum } from "../generated/prisma/enums.js";
import type {
  EstadoFisico as EstadoFisicoDb,
  StatusRastreamento as StatusRastreamentoDb,
  TipoEquipamento as TipoEquipamentoDb
} from "../generated/prisma/client.js";
import RepositorioEquipamento from "../repositories/RepositorioEquipamento.js";

interface DadosNovoEquipamento {
  id?: string;
  codigoBarrasInterno: string;
  tipo: TipoEquipamentoDb;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  estadoFisico: EstadoFisicoDb;
  pesoQuilogramas: number;
  loteId: string;
  posicaoNoLote: number;
  statusRastreamento?: StatusRastreamentoDb;
}

interface DadosMovimentacao {
  id?: string;
  dataHora?: Date;
  origem: string;
  destino: string;
  responsavel: string;
  observacao?: string;
}

function estadoDoBanco(estado: EstadoFisicoDb): EstadoFisicoDominio {
  return EstadoFisicoDominio[estado as keyof typeof EstadoFisicoDominio] as EstadoFisicoDominio;
}

export default class ServicoEquipamento {
  constructor(private readonly repositorio = new RepositorioEquipamento()) {}

  listarEquipamentos() {
    return this.repositorio.listar();
  }

  async buscarEquipamento(id: string) {
    const equipamento = await this.repositorio.buscarPorId(id);
    if (!equipamento) throw new ErroAplicacao("Equipamento não encontrado.", 404);
    return equipamento;
  }

  async rastrearEquipamento(id: string): Promise<Movimentacao[]> {
    const equipamento = await this.repositorio.buscarPorId(id);
    if (!equipamento) throw new ErroAplicacao("Equipamento não encontrado.", 404);
    return equipamento.historicoMovimentacao.map(item => new Movimentacao(
      item.id,
      item.equipamentoId,
      item.dataHora,
      item.origem,
      item.destino,
      item.responsavel,
      item.observacao
    ));
  }

  async atualizarEstadoFisico(
    id: string,
    novoEstadoBanco: EstadoFisicoDb,
    justificativa: string | undefined,
    responsavel: string
  ) {
    const equipamento = await this.repositorio.buscarPorId(id);
    if (!equipamento) throw new ErroAplicacao("Equipamento não encontrado.", 404);

    const novoEstado = EstadoFisicoDominio[novoEstadoBanco as keyof typeof EstadoFisicoDominio] as EstadoFisicoDominio;
    validarJustificativaAlteracaoEstadoFisico(
      estadoDoBanco(equipamento.estadoFisico),
      novoEstado,
      justificativa
    );

    return this.repositorio.atualizarEstadoComMovimentacao({
      id,
      estadoAtual: equipamento.estadoFisico,
      estadoNovo: novoEstadoBanco,
      responsavel,
      observacao: justificativa?.trim() ?? ""
    });
  }

  gerarCodigoBarras(tipo: TipoEquipamentoDominio, sequencia: number): string {
    if (!Number.isInteger(sequencia) || sequencia < 0) {
      throw new ErroAplicacao("A sequência deve ser um número inteiro não negativo.");
    }
    return `EQ-${String(tipo).padStart(2, "0")}-${String(sequencia).padStart(6, "0")}`;
  }

  async registrarMovimentacao(id: string, movimentacao: DadosMovimentacao): Promise<void> {
    const equipamento = await this.repositorio.buscarPorId(id);
    if (!equipamento) throw new ErroAplicacao("Equipamento não encontrado.", 404);

    if (movimentacao.destino.toLowerCase() === "desmonte"
      && equipamento.statusRastreamento !== StatusRastreamentoDbEnum.AGUARDANDO_DESMONTE) {
      throw new ErroAplicacao("O equipamento precisa concluir a triagem antes de ir para desmonte.");
    }

    await this.repositorio.registrarMovimentacao({
      ...(movimentacao.id ? { id: movimentacao.id } : {}),
      equipamento: { connect: { id } },
      ...(movimentacao.dataHora ? { dataHora: movimentacao.dataHora } : {}),
      origem: movimentacao.origem,
      destino: movimentacao.destino,
      responsavel: movimentacao.responsavel,
      observacao: movimentacao.observacao ?? ""
    });
  }

  async concluirTriagem(id: string, responsavel = "sistema"): Promise<void> {
    const equipamento = await this.repositorio.buscarPorId(id);
    if (!equipamento) throw new ErroAplicacao("Equipamento não encontrado.", 404);
    if (equipamento.statusRastreamento !== StatusRastreamentoDbEnum.AGUARDANDO_TRIAGEM) {
      throw new ErroAplicacao("O equipamento não está aguardando triagem.");
    }

    await this.repositorio.concluirTriagemComMovimentacao({
      id,
      statusAtual: StatusRastreamentoDbEnum.AGUARDANDO_TRIAGEM,
      responsavel
    });
  }

  async cadastrarEquipamento(dados: DadosNovoEquipamento) {
    return this.repositorio.criar({
      ...(dados.id ? { id: dados.id } : {}),
      codigoBarrasInterno: dados.codigoBarrasInterno,
      tipo: dados.tipo,
      marca: dados.marca,
      modelo: dados.modelo,
      anoFabricacao: dados.anoFabricacao,
      estadoFisico: dados.estadoFisico,
      pesoQuilogramas: dados.pesoQuilogramas,
      posicaoNoLote: dados.posicaoNoLote,
      ...(dados.statusRastreamento ? { statusRastreamento: dados.statusRastreamento } : {}),
      lote: { connect: { id: dados.loteId } }
    });
  }
}
