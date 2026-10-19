import assert from "node:assert/strict";
import { test } from "node:test";
import EstadoFisico from "../src/domain/enums/EstadoFisico.js";
import { validarJustificativaAlteracaoEstadoFisico } from "../src/domain/regras/EstadoFisico.js";
import ValidadorCNPJ from "../src/infra/validadores/ValidadorCNPJ.js";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";
const { default: ServicoAutenticacao } = await import("../src/services/ServicoAutenticacao.js");

test("pede justificativa para queda de duas ou mais categorias", () => {
  assert.throws(
    () => validarJustificativaAlteracaoEstadoFisico(EstadoFisico.NOVO, EstadoFisico.USADO_LEVE),
    /duas ou mais categorias/
  );
  assert.doesNotThrow(() => validarJustificativaAlteracaoEstadoFisico(
    EstadoFisico.NOVO,
    EstadoFisico.USADO_LEVE,
    "Dano identificado durante a inspeção"
  ));
});

test("permite piora de uma categoria e melhora sem justificativa", () => {
  assert.doesNotThrow(() => validarJustificativaAlteracaoEstadoFisico(
    EstadoFisico.NOVO,
    EstadoFisico.BOM_ESTADO
  ));
  assert.doesNotThrow(() => validarJustificativaAlteracaoEstadoFisico(
    EstadoFisico.INSERVIVEL,
    EstadoFisico.DANIFICADO_GRAVE
  ));
});

test("valida CNPJ e rejeita dígitos verificadores inválidos", () => {
  const validador = new ValidadorCNPJ();
  assert.equal(validador.validar("11.222.333/0001-81"), true);
  assert.equal(validador.validar("11.222.333/0001-82"), false);
  assert.equal(validador.validar("00.000.000/0000-00"), false);
});

test("autoriza operações conforme o papel atribuído", () => {
  assert.equal(ServicoAutenticacao.podeExecutar("ADMINISTRADOR", "organizacao"), true);
  assert.equal(ServicoAutenticacao.podeExecutar("OPERADOR_CADASTRO", "relatorio"), false);
  assert.equal(ServicoAutenticacao.podeExecutar("GESTOR_ALMOXARIFADO", "rastreabilidade"), true);
  assert.equal(ServicoAutenticacao.podeExecutar("AUDITOR", "equipamento"), false);
});
