import type { FastifyInstance } from "fastify";
import { autenticar, autorizar } from "../auth/hooks.js";
import ServicoOrganizacao from "../services/ServicoOrganizacao.js";

interface ContratoBody {
  dataAssinatura: string;
  dataVencimento: string;
  clausulas: string[];
  valorMensal: number;
  renovacaoAutomatica: boolean;
}
interface OrganizacaoBody {
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual?: string;
  enderecoCompleto: string;
  telefone: string;
  email: string;
  contratoVigente?: ContratoBody;
}
interface OrganizacaoPatch {
  razaoSocial?: string;
  cnpj?: string;
  inscricaoEstadual?: string;
  enderecoCompleto?: string;
  telefone?: string;
  email?: string;
  ativo?: boolean;
}

const contratoSchema = {
  type: "object",
  additionalProperties: false,
  required: ["dataAssinatura", "dataVencimento", "clausulas", "valorMensal", "renovacaoAutomatica"],
  properties: {
    dataAssinatura: { type: "string", format: "date-time" },
    dataVencimento: { type: "string", format: "date-time" },
    clausulas: { type: "array", items: { type: "string", minLength: 1 } },
    valorMensal: { type: "number", minimum: 0 },
    renovacaoAutomatica: { type: "boolean" }
  }
} as const;

export default class OrganizacaoController {
  constructor(private readonly servico = new ServicoOrganizacao()) {}

  registrar(app: FastifyInstance): void {
    app.post<{ Body: OrganizacaoBody }>("/organizacoes", {
      preHandler: [autenticar, autorizar("organizacao")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Organizações"], summary: "Cadastra uma organização",
        body: {
          type: "object", additionalProperties: false,
          required: ["razaoSocial", "cnpj", "enderecoCompleto", "telefone", "email"],
          properties: {
            razaoSocial: { type: "string", minLength: 2 },
            cnpj: { type: "string", minLength: 14, maxLength: 18 },
            inscricaoEstadual: { type: "string" },
            enderecoCompleto: { type: "string", minLength: 5 },
            telefone: { type: "string", minLength: 8 },
            email: { type: "string", format: "email" },
            contratoVigente: contratoSchema
          }
        }
      }
    }, async (request, reply) => {
      const { contratoVigente, ...dadosOrganizacao } = request.body;
      const organizacao = await this.servico.cadastrarOrganizacao({
        ...dadosOrganizacao,
        ...(contratoVigente ? {
          contratoVigente: {
            ...contratoVigente,
            dataAssinatura: new Date(contratoVigente.dataAssinatura),
            dataVencimento: new Date(contratoVigente.dataVencimento)
          }
        } : {})
      });
      return reply.code(201).send(organizacao);
    });

    app.get("/organizacoes", {
      preHandler: [autenticar, autorizar("organizacao")],
      schema: { security: [{ bearerAuth: [] }], tags: ["Organizações"], summary: "Lista organizações ativas" }
    }, async () => this.servico.listarOrganizacoesAtivas());

    app.get<{ Params: { id: string } }>("/organizacoes/:id", {
      preHandler: [autenticar, autorizar("organizacao")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Organizações"], summary: "Busca organização por identificador",
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } }
      }
    }, async request => this.servico.buscarOrganizacao(request.params.id));

    app.patch<{ Params: { id: string }; Body: OrganizacaoPatch }>("/organizacoes/:id", {
      preHandler: [autenticar, autorizar("organizacao")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Organizações"], summary: "Atualiza dados da organização",
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
        body: {
          type: "object", minProperties: 1, additionalProperties: false,
          properties: {
            razaoSocial: { type: "string", minLength: 2 },
            cnpj: { type: "string", minLength: 14, maxLength: 18 },
            inscricaoEstadual: { type: "string" },
            enderecoCompleto: { type: "string", minLength: 5 },
            telefone: { type: "string", minLength: 8 },
            email: { type: "string", format: "email" },
            ativo: { type: "boolean" }
          }
        }
      }
    }, async request => this.servico.atualizarOrganizacao(request.params.id, request.body));

    app.delete<{ Params: { id: string } }>("/organizacoes/:id", {
      preHandler: [autenticar, autorizar("organizacao")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Organizações"], summary: "Desativa uma organização",
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } }
      }
    }, async (request, reply) => {
      await this.servico.desativarOrganizacao(request.params.id);
      return reply.code(204).send();
    });

    app.patch<{ Params: { id: string }; Body: { dataVencimento: string } }>("/organizacoes/:id/contrato/renovacao", {
      preHandler: [autenticar, autorizar("organizacao")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Organizações"], summary: "Atualiza o vencimento do contrato",
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
        body: {
          type: "object", additionalProperties: false, required: ["dataVencimento"],
          properties: { dataVencimento: { type: "string", format: "date-time" } }
        }
      }
    }, async (request, reply) => {
      await this.servico.renovarContrato(request.params.id, new Date(request.body.dataVencimento));
      return reply.code(204).send();
    });
  }
}
