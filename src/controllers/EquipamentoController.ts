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
  posicaoNoLote: number;
  statusRastreamento?: keyof typeof StatusRastreamento;
}
interface AlteracaoEstadoBody {
  estadoFisico: keyof typeof EstadoFisico;
  justificativa?: string;
}
interface MovimentacaoBody {
  origem: string;
  destino: string;
  observacao?: string;
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
          required: ["codigoBarrasInterno", "tipo", "marca", "modelo", "anoFabricacao", "estadoFisico", "pesoQuilogramas", "loteId", "posicaoNoLote"],
          properties: {
            codigoBarrasInterno: { type: "string", minLength: 1 },
            tipo: { type: "string", enum: Object.values(TipoEquipamento) },
            marca: { type: "string", minLength: 1 },
            modelo: { type: "string", minLength: 1 },
            anoFabricacao: { type: "integer", minimum: 1900, maximum: new Date().getFullYear() + 1 },
            estadoFisico: { type: "string", enum: Object.values(EstadoFisico) },
            pesoQuilogramas: { type: "number", exclusiveMinimum: 0 },
            loteId: { type: "string", format: "uuid" },
            posicaoNoLote: { type: "integer", minimum: 1 },
            statusRastreamento: { type: "string", enum: Object.values(StatusRastreamento) }
          }
        }
      }
    }, async (request, reply) => reply.code(201).send(await this.servico.cadastrarEquipamento(request.body)));

    app.get("/equipamentos", {
      preHandler: [autenticar, autorizar("equipamento")],
      schema: { security: [{ bearerAuth: [] }], tags: ["Equipamentos"], summary: "Lista equipamentos e histórico" }
    }, async () => this.servico.listarEquipamentos());

    app.get<{ Params: { id: string } }>("/equipamentos/:id", {
      preHandler: [autenticar, autorizar("equipamento")],
      schema: { security: [{ bearerAuth: [] }], tags: ["Equipamentos"], summary: "Busca equipamento por identificador", params: paramsId }
    }, request => this.servico.buscarEquipamento(request.params.id));

    app.get<{ Params: { id: string } }>("/equipamentos/:id/movimentacoes", {
      preHandler: [autenticar, autorizar("rastreabilidade")],
      schema: { security: [{ bearerAuth: [] }], tags: ["Equipamentos"], summary: "Consulta histórico de movimentações", params: paramsId }
    }, request => this.servico.rastrearEquipamento(request.params.id));

    app.patch<{ Params: { id: string }; Body: AlteracaoEstadoBody }>("/equipamentos/:id/estado-fisico", {
      preHandler: [autenticar, autorizar("equipamento")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Equipamentos"], summary: "Altera o estado físico e registra a movimentação", params: paramsId,
        body: {
          type: "object", additionalProperties: false, required: ["estadoFisico"],
          properties: {
            estadoFisico: { type: "string", enum: Object.values(EstadoFisico) },
            justificativa: { type: "string", maxLength: 1000 }
          }
        }
      }
    }, async (request, reply) => {
      const equipamento = await this.servico.atualizarEstadoFisico(
        request.params.id,
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
          type: "object", additionalProperties: false, required: ["origem", "destino"],
          properties: {
            origem: { type: "string", minLength: 1 },
            destino: { type: "string", minLength: 1 },
            observacao: { type: "string", maxLength: 1000 }
          }
        }
      }
    }, async (request, reply) => {
      await this.servico.registrarMovimentacao(request.params.id, {
        ...request.body,
        responsavel: request.user.usuario
      });
      return reply.code(201).send({ status: "registrada" });
    });

    app.post<{ Params: { id: string } }>("/equipamentos/:id/triagem", {
      preHandler: [autenticar, autorizar("equipamento")],
      schema: { security: [{ bearerAuth: [] }], tags: ["Equipamentos"], summary: "Conclui triagem e registra movimentação", params: paramsId }
    }, async (request, reply) => {
      await this.servico.concluirTriagem(request.params.id, request.user.usuario);
      return reply.code(204).send();
    });
  }
}
