import "@fastify/jwt";
import type { PapelUsuario } from "../generated/prisma/client.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      usuario: string;
      papel: PapelUsuario;
    };
    user: {
      sub: string;
      usuario: string;
      papel: PapelUsuario;
    };
  }
}
