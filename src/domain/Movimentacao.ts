export default class Movimentacao{
    constructor(
        private readonly id: string,
        private readonly equipamentoId: string,
        public dataHora: Date,
        public origem: string,
        public destino: string,
        public responsavel: string,
        public observacao: string,
        public readonly version = 0,
        public readonly tipoEvento = "REGISTRO",
        public readonly movimentacaoOrigemId: string | null = null
    ) {}
}
