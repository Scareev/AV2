import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../infra/database/prisma.js";

export default class RepositorioCredencial {
  criar(dados: Prisma.CredencialCreateInput) {
    return prisma.credencial.create({ data: dados });
  }

  buscarPorUsuario(usuario: string) {
    return prisma.credencial.findUnique({ where: { usuario } });
  }

  atualizarSenha(id: string, hashSenha: string, salt: string) {
    return prisma.credencial.update({ where: { id }, data: { hashSenha, salt } });
  }

  registrarAcesso(id: string) {
    return prisma.credencial.update({ where: { id }, data: { ultimoAcesso: new Date() } });
  }
}
