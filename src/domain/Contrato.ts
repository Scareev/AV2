export default class Contrato {
    constructor(
        private readonly id: string,
        public readonly organizacaoId: string,
        public readonly dataAssinatura: Date,
        public dataVencimento: Date,
        public clausulas: string[],
        public valorMensal: number,
        public renovacaoAutomatica: boolean,
        public readonly version = 0,
        public encerradoEm: Date | null = null,
        public motivoEncerramento: string | null = null
    ) {}
}
