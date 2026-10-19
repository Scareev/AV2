import type { FastifyInstance } from "fastify";
import { StatusRastreamento } from "../generated/prisma/enums.js";
import { autenticar, autorizar } from "../auth/hooks.js";
import ServicoRelatorio from "../services/ServicoRelatorio.js";

interface PeriodoQuery { inicio: string; fim: string }

const periodoQuery = {
  type: "object", additionalProperties: false, required: ["inicio", "fim"],
  properties: {
    inicio: { type: "string", format: "date-time" },
    fim: { type: "string", format: "date-time" }
  }
} as const;

export default class RelatorioController {
  constructor(private readonly servico = new ServicoRelatorio()) {}

  registrar(app: FastifyInstance): void {
    app.get<{ Params: { id: string }; Querystring: PeriodoQuery }>("/relatorios/organizacoes/:id/lotes", {
      preHandler: [autenticar, autorizar("relatorio")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Relatórios"], summary: "Gera relatório de lotes por organização e período",
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
        querystring: periodoQuery
      }
    }, request => this.servico.gerarRelatorioPorOrganizacao(
      request.params.id,
      { inicio: new Date(request.query.inicio), fim: new Date(request.query.fim) }
    ));

    app.get<{ Querystring: { status: keyof typeof StatusRastreamento } }>("/relatorios/equipamentos", {
      preHandler: [autenticar, autorizar("relatorio")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Relatórios"], summary: "Gera relatório de equipamentos por status",
        querystring: {
          type: "object", additionalProperties: false, required: ["status"],
          properties: { status: { type: "string", enum: Object.values(StatusRastreamento) } }
        }
      }
    }, request => this.servico.gerarRelatorioPorStatus(request.query.status));

    app.get<{ Querystring: PeriodoQuery }>("/relatorios/financeiro", {
      preHandler: [autenticar, autorizar("relatorio")],
      schema: { security: [{ bearerAuth: [] }],
        tags: ["Relatórios"], summary: "Gera relatório mensal de contratos por período",
        querystring: periodoQuery
      }
    }, request => this.servico.gerarRelatorioFinanceiro({
      inicio: new Date(request.query.inicio),
      fim: new Date(request.query.fim)
    }));
  }
}
