import Contrato from "./Contrato";

export default class Organizacao {
    constructor(
        private readonly id: string,
        public razaoSocial: string,
        private readonly cnpj: string,
        public inscricaoEstadual: string,
        private enderecoCompleto: string,
        public telefone: string,
        public email: string,
        public readonly dataCadastro: Date,
        private ativo: boolean,
        public contratoVigente: Contrato | null
    ) {}
}
