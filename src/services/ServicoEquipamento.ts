import EstadoFisico from "../domain/enums/EstadoFisico";
import TipoEquipamento from "../domain/enums/TipoEquipamento";
import StatusRastreamento from "../domain/enums/StatusRastreamento";
import Movimentacao from "../domain/Movimentacao";
import RepositorioArquivo from "../infra/RepositorioArquivo";

export default class ServicoEquipamento {
    constructor(
        private repositorio: RepositorioArquivo
    ) {}

    rastrearEquipamento(id: string): Movimentacao[] {
        const equipamento = this.carregarEquipamentos().find(item => item.id === id);
        if (equipamento === undefined) {
            throw new Error("Equipamento não encontrado.");
        }

        return equipamento.historicoMovimentacao ?? [];
    }
    // tungstênio garcia
    atualizarEstadoFisico(
        id: string,
        novoEstado: EstadoFisico,
        justificativa?: string
    ): void {
        const equipamentos = this.carregarEquipamentos();
        const equipamento = equipamentos.find(item => item.id === id);
        if (equipamento === undefined) {
            throw new Error("Equipamento não encontrado.");
        }

        const exigeJustificativa = novoEstado === EstadoFisico.DANIFICADO_GRAVE
            || novoEstado === EstadoFisico.INSERVIVEL;
        if (exigeJustificativa && (justificativa === undefined || justificativa.trim() === "")) {
            throw new Error("Este estado físico exige uma justificativa.");
        }

        equipamento.estadoFisico = novoEstado;
        this.repositorio.salvar("equipamentos.json", equipamentos);
    }

    gerarCodigoBarras(
        tipo: TipoEquipamento,
        sequencia: number
    ): string {
        if (!Number.isInteger(sequencia) || sequencia < 0) {
            throw new Error("A sequência deve ser um número inteiro não negativo.");
        }

        return `EQ-${String(tipo).padStart(2, "0")}-${String(sequencia).padStart(6, "0")}`;
    }

    registrarMovimentacao(id: string, movimentacao: Movimentacao): void {
        const equipamentos = this.carregarEquipamentos();
        const equipamento = equipamentos.find(item => item.id === id);
        if (equipamento === undefined) {
            throw new Error("Equipamento não encontrado.");
        }

        if (movimentacao.destino.toLowerCase() === "desmonte"
            && equipamento.statusRastreamento !== StatusRastreamento.AGUARDANDO_DESMONTE) {
            throw new Error("O equipamento precisa concluir a triagem antes de ir para desmonte.");
        }

        equipamento.historicoMovimentacao = equipamento.historicoMovimentacao ?? [];
        equipamento.historicoMovimentacao.push(movimentacao);
        this.repositorio.salvar("equipamentos.json", equipamentos);
    }

    concluirTriagem(id: string): void {
        const equipamentos = this.carregarEquipamentos();
        const equipamento = equipamentos.find(item => item.id === id);
        if (equipamento === undefined) {
            throw new Error("Equipamento não encontrado.");
        }

        if (equipamento.statusRastreamento !== StatusRastreamento.AGUARDANDO_TRIAGEM) {
            throw new Error("O equipamento não está aguardando triagem.");
        }

        equipamento.statusRastreamento = StatusRastreamento.AGUARDANDO_DESMONTE;
        this.repositorio.salvar("equipamentos.json", equipamentos);
    }

    cadastrarEquipamento(equipamento: unknown): void {
        const equipamentos = this.carregarEquipamentos();
        equipamentos.push(equipamento);
        this.repositorio.salvar("equipamentos.json", equipamentos);
    }

    private carregarEquipamentos(): any[] {
        if (!this.repositorio.existe("equipamentos.json")) {
            return [];
        }

        return this.repositorio.ler<any[]>("equipamentos.json");
    }
}