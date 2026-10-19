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

    app.get<{ Querystring: { dataInicio: string; dataFim: string } }>("/lotes", {
      preHandler: [autenticar, autorizar("lote")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Lotes"], summary: "Lista lotes por período de entrada",
        querystring: {
          type: "object", additionalProperties: false, required: ["dataInicio", "dataFim"],
          properties: {
            dataInicio: { type: "string", format: "date-time" },
            dataFim: { type: "string", format: "date-time" }
          }
        }
      }
    }, request => this.servico.consultarLotePorPeriodo(
      new Date(request.query.dataInicio), new Date(request.query.dataFim)
    ));

    app.get<{ Params: { id: string } }>("/lotes/:id", {
      preHandler: [autenticar, autorizar("lote")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Lotes"], summary: "Busca lote e equipamentos",
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } }
      }
    }, request => this.servico.buscarLote(request.params.id));

    app.patch<{ Params: { id: string } }>("/lotes/:id/triagem", {
      preHandler: [autenticar, autorizar("lote")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Lotes"], summary: "Marca a triagem do lote como concluída",
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } }
      }
    }, async (request, reply) => {
      await this.servico.processarTriagem(request.params.id);
      return reply.code(204).send();
    });
  }
}
