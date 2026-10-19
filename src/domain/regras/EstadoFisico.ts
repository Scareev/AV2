import EstadoFisico from "../enums/EstadoFisico";
import ErroAplicacao from "../../errors/ErroAplicacao";

const nivelPorEstado: Record<EstadoFisico, number> = {
    [EstadoFisico.NOVO]: 0,
    [EstadoFisico.BOM_ESTADO]: 1,
    [EstadoFisico.USADO_LEVE]: 2,
    [EstadoFisico.USADO_MODERADO]: 3,
    [EstadoFisico.DANIFICADO_LEVE]: 4,
    [EstadoFisico.DANIFICADO_GRAVE]: 5,
    [EstadoFisico.INSERVIVEL]: 6
};

function obterNivel(estado: EstadoFisico): number {
    const nivel = nivelPorEstado[estado];
    if (!Number.isInteger(nivel)) {
        throw new ErroAplicacao("Estado físico inválido.");
    }
    return nivel;
}

export function validarJustificativaAlteracaoEstadoFisico(
    estadoAtual: EstadoFisico,
    novoEstado: EstadoFisico,
    justificativa?: string
): void {
    const queda = obterNivel(novoEstado) - obterNivel(estadoAtual);
    if (queda >= 2 && (justificativa === undefined || justificativa.trim() === "")) {
        throw new ErroAplicacao("A alteração exige justificativa porque o estado caiu duas ou mais categorias.");
    }
}
