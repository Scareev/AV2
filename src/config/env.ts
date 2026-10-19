import "dotenv/config";

function requiredSecret(name: string, value: string | undefined): string {
    if (value === undefined || value.length < 32 || value.startsWith("change-this")) {
        throw new Error(`${name} deve ser definido com pelo menos 32 caracteres.`);
    }

    return value;
}

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT deve ser um número entre 1 e 65535.");
}

export const env = {
    host: process.env.HOST ?? "0.0.0.0",
    port,
    jwtSecret: requiredSecret("JWT_SECRET", process.env.JWT_SECRET),
    corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173")
        .split(",")
        .map(origin => origin.trim())
        .filter(Boolean)
};
