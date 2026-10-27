import type { FastifyInstance } from "fastify";
import { EstadoFisico, StatusRastreamento, TipoEquipamento } from "../generated/prisma/enums.js";
import { autenticar, autorizar } from "../auth/hooks.js";
import ServicoEquipamento from "../services/ServicoEquipamento.js";

interface EquipamentoBody {
  codigoBarrasInterno: string;
  tipo: keyof typeof TipoEquipamento;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  estadoFisico: keyof typeof EstadoFisico;
  pesoQuilogramas: number;
  loteId: string;
  versionLote: number;
  posicaoNoLote: number;
  statusRastreamento?: keyof typeof StatusRastreamento;
}
interface AlteracaoEstadoBody {
  version: number;
  estadoFisico: keyof typeof EstadoFisico;
  justificativa?: string;
}
interface MovimentacaoBody {
  version: number;
  origem: string;
  destino: string;
  observacao?: string;
}
interface EquipamentoPatchBody {
  version: number;
  marca?: string;
  modelo?: string;
  anoFabricacao?: number;
  pesoQuilogramas?: number;
}
interface CorrecaoMovimentacaoBody {
  version: number;
  destino: string;
  justificativa: string;
}
interface EstornoMovimentacaoBody {
  version: number;
  justificativa: string;
}

const paramsId = {
  type: "object", required: ["id"],
  properties: { id: { type: "string", format: "uuid" } }
} as const;

export default class EquipamentoController {
  constructor(private readonly servico = new ServicoEquipamento()) {}

  registrar(app: FastifyInstance): void {
    app.post<{ Body: EquipamentoBody }>("/equipamentos", {
      preHandler: [autenticar, autorizar("equipamento")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Equipamentos"], summary: "Cadastra equipamento em um lote",
        body: {
          type: "object", additionalProperties: false,
          required: ["codigoBarrasInterno", "tipo", "marca", "modelo", "anoFabricacao", "estadoFisico", "pesoQuilogramas", "loteId", "versionLote", "posicaoNoLote"],
          properties: {
            codigoBarrasInterno: { type: "string", minLength: 1 },
            tipo: { type: "string", enum: Object.values(TipoEquipamento) },
            marca: { type: "string", minLength: 1 },
            modelo: { type: "string", minLength: 1 },
            anoFabricacao: { type: "integer", minimum: 1900, maximum: new Date().getFullYear() + 1 },
            estadoFisico: { type: "string", enum: Object.values(EstadoFisico) },
            pesoQuilogramas: { type: "number", exclusiveMinimum: 0 },
            loteId: { type: "string", format: "uuid" },
            versionLote: { type: "integer", minimum: 0 },
            posicaoNoLote: { type: "integer", minimum: 1 },
            statusRastreamento: { type: "string", enum: Object.values(StatusRastreamento) }
          }
        }
      }
    }, async (request, reply) => reply.code(201).send(await this.servico.cadastrarEquipamento(request.body)));

    app.get<{ Querystring: { incluirCancelados?: boolean } }>("/equipamentos", {
      preHandler: [autenticar, autorizar("equipamento")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Equipamentos"], summary: "Lista equipamentos e histórico",
        querystring: {
          type: "object", additionalProperties: false,
          properties: { incluirCancelados: { type: "boolean", default: false } }
        }
      }
    }, async request => this.servico.listarEquipamentos(request.query.incluirCancelados));

    app.get<{ Params: { id: string } }>("/equipamentos/:id", {
      preHandler: [autenticar, autorizar("equipamento")],
      schema: { security: [{ bearerAuth: [] }], tags: ["Equipamentos"], summary: "Busca equipamento por identificador", params: paramsId }
    }, request => this.servico.buscarEquipamento(request.params.id));

    app.patch<{ Params: { id: string }; Body: EquipamentoPatchBody }>("/equipamentos/:id", {
      preHandler: [autenticar, autorizar("equipamento")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Equipamentos"], summary: "Atualiza dados antes da triagem e de movimentações", params: paramsId,
        body: {
          type: "object", minProperties: 2, additionalProperties: false, required: ["version"],
          properties: {
            version: { type: "integer", minimum: 0 },
            marca: { type: "string", minLength: 1 },
            modelo: { type: "string", minLength: 1 },
            anoFabricacao: { type: "integer", minimum: 1900, maximum: new Date().getFullYear() + 1 },
            pesoQuilogramas: { type: "number", exclusiveMinimum: 0 }
          }
        }
      }
    }, request => {
      const { version, ...dados } = request.body;
      return this.servico.atualizarEquipamento(request.params.id, version, dados);
    });

    app.delete<{ Params: { id: string }; Body: { version: number; motivo: string } }>("/equipamentos/:id", {
      preHandler: [autenticar, autorizar("equipamento")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Equipamentos"], summary: "Cancela equipamento sem apagar o histórico", params: paramsId,
        body: {
          type: "object", additionalProperties: false, required: ["version", "motivo"],
          properties: { version: { type: "integer", minimum: 0 }, motivo: { type: "string", minLength: 1 } }
        }
      }
    }, async (request, reply) => {
      await this.servico.cancelarEquipamento(request.params.id, request.body.version, request.body.motivo);
      return reply.code(204).send();
    });

    app.get<{ Params: { id: string } }>("/equipamentos/:id/movimentacoes", {
      preHandler: [autenticar, autorizar("rastreabilidade")],
      schema: { security: [{ bearerAuth: [] }], tags: ["Equipamentos"], summary: "Consulta histórico de movimentações", params: paramsId }
    }, request => this.servico.rastrearEquipamento(request.params.id));

    app.patch<{ Params: { id: string }; Body: AlteracaoEstadoBody }>("/equipamentos/:id/estado-fisico", {
      preHandler: [autenticar, autorizar("equipamento")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Equipamentos"], summary: "Altera o estado físico e registra a movimentação", params: paramsId,
        body: {
          type: "object", additionalProperties: false, required: ["version", "estadoFisico"],
          properties: {
            version: { type: "integer", minimum: 0 },
            estadoFisico: { type: "string", enum: Object.values(EstadoFisico) },
            justificativa: { type: "string", maxLength: 1000 }
          }
        }
      }
    }, async (request, reply) => {
      const equipamento = await this.servico.atualizarEstadoFisico(
        request.params.id,
        request.body.version,
        request.body.estadoFisico,
        request.body.justificativa,
        request.user.usuario
      );
      return reply.send(equipamento);
    });

    app.post<{ Params: { id: string }; Body: MovimentacaoBody }>("/equipamentos/:id/movimentacoes", {
      preHandler: [autenticar, autorizar("equipamento")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Equipamentos"], summary: "Registra movimentação de equipamento", params: paramsId,
        body: {
          type: "object", additionalProperties: false, required: ["version", "origem", "destino"],
          properties: {
            version: { type: "integer", minimum: 0 },
            origem: { type: "string", minLength: 1 },
            destino: { type: "string", minLength: 1 },
            observacao: { type: "string", maxLength: 1000 }
          }
        }
      }
    }, async (request, reply) => {
      const { version, ...dados } = request.body;
      await this.servico.registrarMovimentacao(request.params.id, version, {
        ...dados,
        responsavel: request.user.usuario
      });
      return reply.code(201).send({ status: "registrada" });
    });

    app.post<{
      Params: { id: string; movimentacaoId: string };
      Body: CorrecaoMovimentacaoBody;
    }>("/equipamentos/:id/movimentacoes/:movimentacaoId/correcoes", {
      preHandler: [autenticar, autorizar("equipamento")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Equipamentos"], summary: "Corrige movimentação sem apagar o evento original",
        params: {
          type: "object", required: ["id", "movimentacaoId"], additionalProperties: false,
          properties: {
            id: { type: "string", format: "uuid" },
            movimentacaoId: { type: "string", format: "uuid" }
          }
        },
        body: {
          type: "object", additionalProperties: false, required: ["version", "destino", "justificativa"],
          properties: {
            version: { type: "integer", minimum: 0 },
            destino: { type: "string", minLength: 1 },
            justificativa: { type: "string", minLength: 1, maxLength: 1000 }
          }
        }
      }
    }, async (request, reply) => {
      const evento = await this.servico.corrigirMovimentacao(
        request.params.id,
        request.params.movimentacaoId,
        request.body.version,
        request.body.destino,
        request.body.justificativa,
        request.user.usuario
      );
      return reply.code(201).send(evento);
    });

    app.post<{
      Params: { id: string; movimentacaoId: string };
      Body: EstornoMovimentacaoBody;
    }>("/equipamentos/:id/movimentacoes/:movimentacaoId/estornos", {
      preHandler: [autenticar, autorizar("equipamento")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Equipamentos"], summary: "Estorna movimentação sem apagar o evento original",
        params: {
          type: "object", required: ["id", "movimentacaoId"], additionalProperties: false,
          properties: {
            id: { type: "string", format: "uuid" },
            movimentacaoId: { type: "string", format: "uuid" }
          }
        },
        body: {
          type: "object", additionalProperties: false, required: ["version", "justificativa"],
          properties: {
            version: { type: "integer", minimum: 0 },
            justificativa: { type: "string", minLength: 1, maxLength: 1000 }
          }
        }
      }
    }, async (request, reply) => {
      const evento = await this.servico.estornarMovimentacao(
        request.params.id,
        request.params.movimentacaoId,
        request.body.version,
        request.body.justificativa,
        request.user.usuario
      );
      return reply.code(201).send(evento);
    });

    app.post<{ Params: { id: string }; Body: { version: number } }>("/equipamentos/:id/triagem", {
      preHandler: [autenticar, autorizar("equipamento")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Equipamentos"], summary: "Conclui triagem e registra movimentação", params: paramsId,
        body: {
          type: "object", additionalProperties: false, required: ["version"],
          properties: { version: { type: "integer", minimum: 0 } }
        }
      }
    }, async (request, reply) => {
      await this.servico.concluirTriagem(request.params.id, request.body.version, request.user.usuario);
      return reply.code(204).send();
    });
  }
}
