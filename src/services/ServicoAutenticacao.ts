import bcrypt from "bcrypt";
import type { PapelUsuario } from "../generated/prisma/client.js";
import RepositorioCredencial from "../repositories/RepositorioCredencial.js";

export interface IdentidadeAutenticada {
  id: string;
  usuario: string;
  papel: PapelUsuario;
}

export type OperacaoPermitida =
  | "organizacao"
  | "lote"
  | "equipamento"
  | "relatorio"
  | "auditoria"
  | "rastreabilidade";

const permissoes: Record<PapelUsuario, readonly OperacaoPermitida[]> = {
  ADMINISTRADOR: ["organizacao", "lote", "equipamento", "relatorio", "auditoria"],
  OPERADOR_CADASTRO: ["organizacao", "lote", "equipamento"],
  GESTOR_ALMOXARIFADO: ["lote", "equipamento", "rastreabilidade"],
  AUDITOR: ["rastreabilidade", "relatorio", "auditoria"]
};

export default class ServicoAutenticacao {
  constructor(private readonly repositorio = new RepositorioCredencial()) {}

  async autenticar(usuario: string, senha: string): Promise<IdentidadeAutenticada | null> {
    const credencial = await this.repositorio.buscarPorUsuario(usuario.trim());
    if (!credencial) return null;

    let senhaValida = false;
    try {
      senhaValida = await bcrypt.compare(senha, credencial.hashSenha);
    } catch {
      senhaValida = false;
    }
    if (!senhaValida) return null;

    await this.repositorio.registrarAcesso(credencial.id);
    return {
      id: credencial.id,
      usuario: credencial.usuario,
      papel: credencial.papel
    };
  }

  async criarCredencial(usuario: string, senha: string, papel: PapelUsuario): Promise<IdentidadeAutenticada> {
    const identificador = usuario.trim();
    if (!identificador || senha.length < 12) {
      throw new Error("Usuário é obrigatório e a senha deve ter pelo menos 12 caracteres.");
    }
    if (await this.repositorio.buscarPorUsuario(identificador)) {
      throw new Error("Usuário já cadastrado.");
    }

    const salt = await bcrypt.genSalt(12);
    const hashSenha = await bcrypt.hash(senha, salt);
    try {
      const credencial = await this.repositorio.criar({
        usuario: identificador,
        hashSenha,
        salt,
        papel
      });
      return { id: credencial.id, usuario: credencial.usuario, papel: credencial.papel };
    } catch (erro) {
      if (typeof erro === "object" && erro !== null && "code" in erro && erro.code === "P2002") {
        throw new Error("Usuário já cadastrado.");
      }
      throw erro;
    }
  }

  async alterarSenha(usuario: string, senhaAntiga: string, senhaNova: string): Promise<boolean> {
    const credencial = await this.repositorio.buscarPorUsuario(usuario.trim());
    if (!credencial || !(await bcrypt.compare(senhaAntiga, credencial.hashSenha))) return false;
    if (senhaNova.length < 12) throw new Error("A nova senha deve ter pelo menos 12 caracteres.");

    const salt = await bcrypt.genSalt(12);
    const hashSenha = await bcrypt.hash(senhaNova, salt);
    await this.repositorio.atualizarSenha(credencial.id, hashSenha, salt);
    return true;
  }

  static podeExecutar(papel: PapelUsuario, operacao: string): boolean {
    return permissoes[papel]?.includes(operacao as OperacaoPermitida) ?? false;
  }
}
