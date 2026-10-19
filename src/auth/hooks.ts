import type { FastifyReply, FastifyRequest } from "fastify";
import ServicoAutenticacao, { type OperacaoPermitida } from "../services/ServicoAutenticacao.js";

export async function autenticar(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ erro: "Autenticação necessária ou token inválido/expirado." });
  }
}

export function autorizar(operacao: OperacaoPermitida) {
  return async function autorizarOperacao(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!ServicoAutenticacao.podeExecutar(request.user.papel, operacao)) {
      reply.code(403).send({ erro: "Seu papel não permite esta operação." });
    }
  };
}
