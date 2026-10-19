import type { FastifyInstance } from "fastify";
import ServicoAutenticacao from "../services/ServicoAutenticacao.js";

interface DadosLogin {
  usuario: string;
  senha: string;
}

export default class AutenticacaoController {
  constructor(private readonly autenticacao = new ServicoAutenticacao()) {}

  registrar(rotas: FastifyInstance): void {
    rotas.post<{ Body: DadosLogin }>("/auth/login", {
      schema: {
        tags: ["Autenticação"],
        summary: "Autentica usuário e emite JWT",
        body: {
          type: "object",
          additionalProperties: false,
          required: ["usuario", "senha"],
          properties: {
            usuario: { type: "string", minLength: 1 },
            senha: { type: "string", minLength: 1 }
          }
        },
        response: {
          200: {
            type: "object",
            required: ["token", "tipo", "expiraEm", "usuario"],
            properties: {
              token: { type: "string" },
              tipo: { type: "string", const: "Bearer" },
              expiraEm: { type: "integer", const: 1800 },
              usuario: {
                type: "object",
                required: ["id", "usuario", "papel"],
                properties: {
                  id: { type: "string" },
                  usuario: { type: "string" },
                  papel: { type: "string" }
                }
              }
            }
          },
          401: {
            type: "object",
            required: ["erro"],
            properties: { erro: { type: "string" } }
          }
        }
      }
    }, async (request, reply) => {
      const identidade = await this.autenticacao.autenticar(request.body.usuario, request.body.senha);
      if (!identidade) return reply.code(401).send({ erro: "Usuário ou senha inválidos." });

      const token = await reply.jwtSign({
        sub: identidade.id,
        usuario: identidade.usuario,
        papel: identidade.papel
      });
      return reply.send({ token, tipo: "Bearer", expiraEm: 1800, usuario: identidade });
    });
  }
}
