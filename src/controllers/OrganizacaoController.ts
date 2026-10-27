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
  version: number;
  razaoSocial?: string;
  cnpj?: string;
  inscricaoEstadual?: string;
  enderecoCompleto?: string;
  telefone?: string;
  email?: string;
  ativo?: boolean;
}
interface ContratoPatchBody {
  version: number;
  dataAssinatura?: string;
  dataVencimento?: string;
  clausulas?: string[];
  valorMensal?: number;
  renovacaoAutomatica?: boolean;
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
          type: "object", minProperties: 2, additionalProperties: false, required: ["version"],
          properties: {
            version: { type: "integer", minimum: 0 },
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
    }, async request => {
      const { version, ...dados } = request.body;
      return this.servico.atualizarOrganizacao(request.params.id, version, dados);
    });

    app.delete<{ Params: { id: string }; Querystring: { version: number } }>("/organizacoes/:id", {
      preHandler: [autenticar, autorizar("organizacao")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Organizações"], summary: "Desativa uma organização",
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
        querystring: {
          type: "object", additionalProperties: false, required: ["version"],
          properties: { version: { type: "integer", minimum: 0 } }
        }
      }
    }, async (request, reply) => {
      await this.servico.desativarOrganizacao(request.params.id, request.query.version);
      return reply.code(204).send();
    });

    app.patch<{ Params: { id: string }; Body: { dataVencimento: string; version: number } }>("/organizacoes/:id/contrato/renovacao", {
      preHandler: [autenticar, autorizar("organizacao")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Organizações"], summary: "Atualiza o vencimento do contrato",
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
        body: {
          type: "object", additionalProperties: false, required: ["dataVencimento", "version"],
          properties: {
            dataVencimento: { type: "string", format: "date-time" },
            version: { type: "integer", minimum: 0 }
          }
        }
      }
    }, async (request, reply) => {
      await this.servico.renovarContrato(request.params.id, new Date(request.body.dataVencimento), request.body.version);
      return reply.code(204).send();
    });

    app.get<{ Params: { id: string } }>("/organizacoes/:id/contratos", {
      preHandler: [autenticar, autorizar("organizacao")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Organizações"], summary: "Lista o contrato associado à organização",
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } }
      }
    }, request => this.servico.listarContratos(request.params.id));

    app.post<{ Params: { id: string }; Body: ContratoBody }>("/organizacoes/:id/contratos", {
      preHandler: [autenticar, autorizar("organizacao")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Organizações"], summary: "Cadastra contrato para a organização",
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
        body: contratoSchema
      }
    }, async (request, reply) => {
      const contrato = await this.servico.cadastrarContrato(request.params.id, {
        ...request.body,
        dataAssinatura: new Date(request.body.dataAssinatura),
        dataVencimento: new Date(request.body.dataVencimento)
      });
      return reply.code(201).send(contrato);
    });

    app.patch<{ Params: { id: string; contratoId: string }; Body: ContratoPatchBody }>("/organizacoes/:id/contratos/:contratoId", {
      preHandler: [autenticar, autorizar("organizacao")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Organizações"], summary: "Atualiza contrato da organização",
        params: {
          type: "object", required: ["id", "contratoId"], additionalProperties: false,
          properties: { id: { type: "string", format: "uuid" }, contratoId: { type: "string", format: "uuid" } }
        },
        body: {
          type: "object", minProperties: 2, additionalProperties: false, required: ["version"],
          properties: {
            version: { type: "integer", minimum: 0 },
            dataAssinatura: { type: "string", format: "date-time" },
            dataVencimento: { type: "string", format: "date-time" },
            clausulas: { type: "array", items: { type: "string", minLength: 1 } },
            valorMensal: { type: "number", minimum: 0 },
            renovacaoAutomatica: { type: "boolean" }
          }
        }
      }
    }, request => {
      const { version, dataAssinatura, dataVencimento, ...resto } = request.body;
      return this.servico.atualizarContrato(request.params.id, request.params.contratoId, version, {
        ...resto,
        ...(dataAssinatura ? { dataAssinatura: new Date(dataAssinatura) } : {}),
        ...(dataVencimento ? { dataVencimento: new Date(dataVencimento) } : {})
      });
    });

    app.delete<{ Params: { id: string; contratoId: string }; Body: { version: number; motivo: string } }>("/organizacoes/:id/contratos/:contratoId", {
      preHandler: [autenticar, autorizar("organizacao")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Organizações"], summary: "Encerra contrato preservando o registro histórico",
        params: {
          type: "object", required: ["id", "contratoId"], additionalProperties: false,
          properties: { id: { type: "string", format: "uuid" }, contratoId: { type: "string", format: "uuid" } }
        },
        body: {
          type: "object", additionalProperties: false, required: ["version", "motivo"],
          properties: { version: { type: "integer", minimum: 0 }, motivo: { type: "string", minLength: 1 } }
        }
      }
    }, async (request, reply) => {
      await this.servico.encerrarContrato(request.params.id, request.params.contratoId, request.body.version, request.body.motivo);
      return reply.code(204).send();
    });
  }
}
