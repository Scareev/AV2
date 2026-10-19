import ErroAplicacao from "../errors/ErroAplicacao.js";
import type {
  EstadoFisico as EstadoFisicoDb,
  Prisma,
  StatusLote as StatusLoteDb,
  StatusRastreamento as StatusRastreamentoDb,
  TipoEquipamento as TipoEquipamentoDb
} from "../generated/prisma/client.js";
import RepositorioLote from "../repositories/RepositorioLote.js";
import ValidadorDataEntrada from "../infra/validadores/ValidadorDataEntrada.js";

interface DadosEquipamentoLote {
  id?: string;
  codigoBarrasInterno: string;
  tipo: TipoEquipamentoDb;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  estadoFisico: EstadoFisicoDb;
  pesoQuilogramas: number;
  posicaoNoLote: number;
  statusRastreamento?: StatusRastreamentoDb;
}

interface DadosNovoLote {
  id?: string;
  dataEntrada?: Date;
  organizacaoId: string;
  notaFiscal: string;
  transportadora: string;
  statusProcessamento?: StatusLoteDb;
  observacoes?: string;
  equipamentos?: DadosEquipamentoLote[];
}

export default class ServicoLote {
  constructor(
    private readonly repositorio = new RepositorioLote(),
    private readonly validadorDataEntrada = new ValidadorDataEntrada()
  ) {}

  async criarLote(dados: DadosNovoLote) {
    const dataEntrada = dados.dataEntrada ?? new Date();
    if (!this.validadorDataEntrada.validar(dataEntrada)) {
      throw new ErroAplicacao(this.validadorDataEntrada.obterMensagemErro());
    }

    const equipamentoCreate: Prisma.EquipamentoCreateWithoutLoteInput[] = (dados.equipamentos ?? []).map(equipamento => ({
      ...(equipamento.id ? { id: equipamento.id } : {}),
      codigoBarrasInterno: equipamento.codigoBarrasInterno,
      tipo: equipamento.tipo,
      marca: equipamento.marca,
      modelo: equipamento.modelo,
      anoFabricacao: equipamento.anoFabricacao,
      estadoFisico: equipamento.estadoFisico,
      pesoQuilogramas: equipamento.pesoQuilogramas,
      posicaoNoLote: equipamento.posicaoNoLote,
      ...(equipamento.statusRastreamento ? { statusRastreamento: equipamento.statusRastreamento } : {})
    }));

    const data: Prisma.LoteCreateInput = {
      ...(dados.id ? { id: dados.id } : {}),
      dataEntrada,
      notaFiscal: dados.notaFiscal,
      transportadora: dados.transportadora,
      ...(dados.statusProcessamento ? { statusProcessamento: dados.statusProcessamento } : {}),
      observacoes: dados.observacoes ?? "",
      organizacao: { connect: { id: dados.organizacaoId } },
      equipamentos: { create: equipamentoCreate }
    };
    return this.repositorio.criar(data);
  }

  async buscarLote(id: string) {
    const lote = await this.repositorio.buscarPorId(id);
    if (!lote) throw new ErroAplicacao("Lote não encontrado.", 404);
    return lote;
  }

  async adicionarEquipamentoLote(loteId: string, equipamento: DadosEquipamentoLote): Promise<void> {
    if (!await this.repositorio.buscarPorId(loteId)) {
      throw new ErroAplicacao("Lote não encontrado.", 404);
    }
    await this.repositorio.adicionarEquipamento(loteId, equipamento);
  }

  async processarTriagem(loteId: string): Promise<void> {
    if (!await this.repositorio.buscarPorId(loteId)) {
      throw new ErroAplicacao("Lote não encontrado.", 404);
    }
    await this.repositorio.atualizar(loteId, { statusProcessamento: "TRIAGEM_CONCLUIDA" });
  }

  consultarLotePorPeriodo(dataInicio: Date, dataFim: Date) {
    if (dataInicio > dataFim) throw new ErroAplicacao("O início do período deve ser anterior ao fim.");
    return this.repositorio.listarPorPeriodo(dataInicio, dataFim);
  }
}
