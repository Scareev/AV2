import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { env } from "../config/env.js";
import { prisma } from "../infra/database/prisma.js";
import AutenticacaoController from "../controllers/AutenticacaoController.js";
import OrganizacaoController from "../controllers/OrganizacaoController.js";
import LoteController from "../controllers/LoteController.js";
import EquipamentoController from "../controllers/EquipamentoController.js";
import RelatorioController from "../controllers/RelatorioController.js";
import ErroAplicacao from "../errors/ErroAplicacao.js";

export async function buildServer() {
    const app = Fastify({ logger: true });

    await app.register(cors, { origin: env.corsOrigins });
    app.addHook("onClose", async () => {
        await prisma.$disconnect();
    });
    await app.register(jwt, { secret: env.jwtSecret, sign: { expiresIn: "30m" } });
    await app.register(swagger, {
        openapi: {
            info: {
                title: "GreenCode API",
                description: "API da plataforma de logística reversa GreenCode.",
                version: "1.0.0"
            },
            tags: [{ name: "Sistema", description: "Disponibilidade e documentação" },
                { name: "Autenticação", description: "Login e emissão de token JWT" },
                { name: "Organizações", description: "Cadastro e gestão de organizações/contratos" },
                { name: "Lotes", description: "Recebimento e triagem de lotes" },
                { name: "Equipamentos", description: "Cadastro, estado e rastreabilidade" },
                { name: "Relatórios", description: "Consultas operacionais e financeiras" }],
            components: {
                securitySchemes: {
                    bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
                }
            }
        }
    });
    await app.register(swaggerUi, { routePrefix: "/docs" });

    new AutenticacaoController().registrar(app);
    new OrganizacaoController().registrar(app);
    new LoteController().registrar(app);
    new EquipamentoController().registrar(app);
    new RelatorioController().registrar(app);

    app.setErrorHandler((error, request, reply) => {
        if (error instanceof ErroAplicacao) {
            return reply.code(error.statusCode).send({ erro: error.message });
        }

        const details = typeof error === "object" && error !== null
            ? error as { code?: unknown; validation?: unknown; statusCode?: unknown }
            : {};
        const codigo = details.code;
        if (codigo === "P2002") return reply.code(409).send({ erro: "Já existe um registro com os mesmos dados únicos." });
        if (codigo === "P2025") return reply.code(404).send({ erro: "Registro não encontrado." });
        if (codigo === "P2003") return reply.code(400).send({ erro: "A referência informada não existe ou está em uso." });
        if (codigo === "P2034") return reply.code(409).send({ erro: "Conflito de atualização. Recarregue os dados e tente novamente." });
        const statusCode = typeof details.statusCode === "number" ? details.statusCode : undefined;
        const message = error instanceof Error ? error.message : "Erro na solicitação.";
        if (details.validation || (statusCode !== undefined && statusCode < 500)) {
            return reply.code(statusCode ?? 400).send({ erro: message });
        }

        request.log.error(error);
        return reply.code(500).send({ erro: "Erro interno do servidor." });
    });

    app.get("/health", {
        schema: {
            tags: ["Sistema"],
            summary: "Verifica a disponibilidade da API",
            response: {
                200: {
                    type: "object",
                    properties: { status: { type: "string" } },
                    required: ["status"]
                }
            }
        }
    }, async () => ({ status: "ok" }));

    return app;
}
