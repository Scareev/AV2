export default class ErroAplicacao extends Error {
  constructor(mensagem: string, readonly statusCode = 400) {
    super(mensagem);
    this.name = "ErroAplicacao";
  }
}
