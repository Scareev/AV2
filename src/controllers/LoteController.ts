import type { FastifyInstance } from "fastify";
import { EstadoFisico, StatusLote, StatusRastreamento, TipoEquipamento } from "../generated/prisma/enums.js";
import { autenticar, autorizar } from "../auth/hooks.js";
import ServicoLote from "../services/ServicoLote.js";

interface EquipamentoLoteBody {
  codigoBarrasInterno: string;
  tipo: keyof typeof TipoEquipamento;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  estadoFisico: keyof typeof EstadoFisico;
  pesoQuilogramas: number;
  posicaoNoLote: number;
  statusRastreamento?: keyof typeof StatusRastreamento;
}
interface LoteBody {
  organizacaoId: string;
  dataEntrada?: string;
  notaFiscal: string;
  transportadora: string;
  statusProcessamento?: keyof typeof StatusLote;
  observacoes?: string;
  equipamentos?: EquipamentoLoteBody[];
}
interface LotePatchBody {
  version: number;
  dataEntrada?: string;
  notaFiscal?: string;
  transportadora?: string;
  observacoes?: string;
}

const equipamentoSchema = {
  type: "object", additionalProperties: false,
  required: ["codigoBarrasInterno", "tipo", "marca", "modelo", "anoFabricacao", "estadoFisico", "pesoQuilogramas", "posicaoNoLote"],
  properties: {
    codigoBarrasInterno: { type: "string", minLength: 1 },
    tipo: { type: "string", enum: Object.values(TipoEquipamento) },
    marca: { type: "string", minLength: 1 },
    modelo: { type: "string", minLength: 1 },
    anoFabricacao: { type: "integer", minimum: 1900, maximum: new Date().getFullYear() + 1 },
    estadoFisico: { type: "string", enum: Object.values(EstadoFisico) },
    pesoQuilogramas: { type: "number", exclusiveMinimum: 0 },
    posicaoNoLote: { type: "integer", minimum: 1 },
    statusRastreamento: { type: "string", enum: Object.values(StatusRastreamento) }
  }
} as const;

export default class LoteController {
  constructor(private readonly servico = new ServicoLote()) {}

  registrar(app: FastifyInstance): void {
    app.post<{ Body: LoteBody }>("/lotes", {
      preHandler: [autenticar, autorizar("lote")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Lotes"], summary: "Cria lote e equipamentos iniciais",
        body: {
          type: "object", additionalProperties: false,
          required: ["organizacaoId", "notaFiscal", "transportadora"],
          properties: {
            organizacaoId: { type: "string", format: "uuid" },
            dataEntrada: { type: "string", format: "date-time" },
            notaFiscal: { type: "string", minLength: 1 },
            transportadora: { type: "string", minLength: 1 },
            statusProcessamento: { type: "string", enum: Object.values(StatusLote) },
            observacoes: { type: "string" },
            equipamentos: { type: "array", items: equipamentoSchema }
          }
        }
      }
    }, async (request, reply) => {
      const { dataEntrada, ...body } = request.body;
      const lote = await this.servico.criarLote({
        ...body,
        ...(dataEntrada ? { dataEntrada: new Date(dataEntrada) } : {})
      });
      return reply.code(201).send(lote);
    });

    app.get<{ Querystring: { dataInicio: string; dataFim: string; incluirCancelados?: boolean } }>("/lotes", {
      preHandler: [autenticar, autorizar("lote")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Lotes"], summary: "Lista lotes por período de entrada",
        querystring: {
          type: "object", additionalProperties: false, required: ["dataInicio", "dataFim"],
          properties: {
            dataInicio: { type: "string", format: "date-time" },
            dataFim: { type: "string", format: "date-time" },
            incluirCancelados: { type: "boolean", default: false }
          }
        }
      }
    }, request => this.servico.consultarLotePorPeriodo(
      new Date(request.query.dataInicio), new Date(request.query.dataFim), request.query.incluirCancelados
    ));

    app.get<{ Params: { id: string } }>("/lotes/:id", {
      preHandler: [autenticar, autorizar("lote")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Lotes"], summary: "Busca lote e equipamentos",
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } }
      }
    }, request => this.servico.buscarLote(request.params.id));

    app.patch<{ Params: { id: string }; Body: LotePatchBody }>("/lotes/:id", {
      preHandler: [autenticar, autorizar("lote")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Lotes"], summary: "Atualiza dados do lote antes da triagem",
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
        body: {
          type: "object", minProperties: 2, additionalProperties: false, required: ["version"],
          properties: {
            version: { type: "integer", minimum: 0 },
            dataEntrada: { type: "string", format: "date-time" },
            notaFiscal: { type: "string", minLength: 1 },
            transportadora: { type: "string", minLength: 1 },
            observacoes: { type: "string" }
          }
        }
      }
    }, request => {
      const { version, dataEntrada, ...dados } = request.body;
      return this.servico.atualizarLote(request.params.id, version, {
        ...dados,
        ...(dataEntrada ? { dataEntrada: new Date(dataEntrada) } : {})
      });
    });

    app.delete<{ Params: { id: string }; Body: { version: number; motivo: string } }>("/lotes/:id", {
      preHandler: [autenticar, autorizar("lote")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Lotes"], summary: "Cancela lote e equipamentos sem apagar o histórico",
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
        body: {
          type: "object", additionalProperties: false, required: ["version", "motivo"],
          properties: { version: { type: "integer", minimum: 0 }, motivo: { type: "string", minLength: 1 } }
        }
      }
    }, async (request, reply) => {
      await this.servico.cancelarLote(request.params.id, request.body.version, request.body.motivo);
      return reply.code(204).send();
    });

    app.patch<{ Params: { id: string }; Body: { version: number } }>("/lotes/:id/triagem", {
      preHandler: [autenticar, autorizar("lote")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Lotes"], summary: "Marca a triagem do lote como concluída",
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
        body: {
          type: "object", additionalProperties: false, required: ["version"],
          properties: { version: { type: "integer", minimum: 0 } }
        }
      }
    }, async (request, reply) => {
      await this.servico.processarTriagem(request.params.id, request.body.version);
      return reply.code(204).send();
    });
  }
}
