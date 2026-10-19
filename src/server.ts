import { env } from "./config/env.js";
import { buildServer } from "./server/app.js";

async function start(): Promise<void> {
    const app = await buildServer();

    try {
        await app.listen({ host: env.host, port: env.port });
        app.log.info(`GreenCode API disponível em http://${env.host}:${env.port}`);
    } catch (error) {
        app.log.error(error, "Falha ao iniciar o servidor.");
        process.exitCode = 1;
        return;
    }

    let closing = false;
    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
        if (closing) return;
        closing = true;
        app.log.info({ signal }, "Encerrando o servidor graciosamente.");

        try {
            await app.close();
        } catch (error) {
            app.log.error(error, "Falha durante o encerramento do servidor.");
            process.exitCode = 1;
        }
    };

    process.once("SIGINT", () => { void shutdown("SIGINT"); });
    process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
}

void start().catch(error => {
    console.error("Falha ao iniciar a API.", error);
    process.exitCode = 1;
});
