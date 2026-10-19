import bcrypt from "bcrypt";
import {
  EstadoFisico,
  PapelUsuario,
  StatusLote,
  StatusRastreamento,
  TipoEquipamento
} from "../src/generated/prisma/enums.js";
import { prisma } from "../src/infra/database/prisma.js";

const adminUsuario = process.env.SEED_ADMIN_USERNAME?.trim() || "admin";
const adminSenha = (() => {
  const senha = process.env.SEED_ADMIN_PASSWORD;
  if (!senha || senha.length < 12 || senha.startsWith("change-this")) {
    throw new Error("Defina SEED_ADMIN_PASSWORD com pelo menos 12 caracteres antes de executar o seed.");
  }
  return senha;
})();

async function seed(): Promise<void> {
  const senhaSalt = await bcrypt.genSalt(12);
  const hashSenha = await bcrypt.hash(adminSenha, senhaSalt);

  await prisma.$transaction(async (tx) => {
    await tx.organizacao.upsert({
      where: { id: "11111111-1111-4111-8111-111111111111" },
      update: {},
      create: {
        id: "11111111-1111-4111-8111-111111111111",
        razaoSocial: "Cooperativa Recicla Centro",
        cnpj: "11222333000181",
        inscricaoEstadual: "ISENTO",
        enderecoCompleto: "Rua das Oficinas, 120 - Centro, São Paulo/SP",
        telefone: "+55 11 3000-1000",
        email: "contato@reciclacentro.example",
        ativo: true,
        contratoVigente: {
          create: {
            dataAssinatura: new Date("2026-01-10T12:00:00.000Z"),
            dataVencimento: new Date("2027-01-10T12:00:00.000Z"),
            clausulas: ["Coleta programada", "Certificado de destinação"],
            valorMensal: "1250.00",
            renovacaoAutomatica: true
          }
        }
      }
    });

    await tx.organizacao.upsert({
      where: { id: "22222222-2222-4222-8222-222222222222" },
      update: {},
      create: {
        id: "22222222-2222-4222-8222-222222222222",
        razaoSocial: "Instituto Horizonte",
        cnpj: "45576418000180",
        inscricaoEstadual: "ISENTO",
        enderecoCompleto: "Av. das Nações, 850 - Campinas/SP",
        telefone: "+55 19 3000-2000",
        email: "infra@horizonte.example",
        ativo: true
      }
    });

    await tx.lote.upsert({
      where: { id: "33333333-3333-4333-8333-333333333333" },
      update: {},
      create: {
        id: "33333333-3333-4333-8333-333333333333",
        organizacaoId: "11111111-1111-4111-8111-111111111111",
        dataEntrada: new Date("2026-10-01T12:00:00.000Z"),
        notaFiscal: "NF-AV2-001",
        transportadora: "Logística Circular",
        statusProcessamento: StatusLote.TRIAGEM_CONCLUIDA,
        observacoes: "Lote de demonstração com triagem concluída"
      }
    });

    await tx.lote.upsert({
      where: { id: "44444444-4444-4444-8444-444444444444" },
      update: {},
      create: {
        id: "44444444-4444-4444-8444-444444444444",
        organizacaoId: "22222222-2222-4222-8222-222222222222",
        dataEntrada: new Date("2026-10-10T12:00:00.000Z"),
        notaFiscal: "NF-AV2-002",
        transportadora: "Rota Verde",
        statusProcessamento: StatusLote.EM_TRIAGEM,
        observacoes: "Equipamentos aguardam avaliação"
      }
    });

    const equipamentos = [
      {
        id: "55555555-5555-4555-8555-555555555551",
        codigoBarrasInterno: "EQ-NB-000001",
        tipo: TipoEquipamento.NOTEBOOK,
        marca: "Lenovo",
        modelo: "ThinkPad T14",
        anoFabricacao: 2022,
        estadoFisico: EstadoFisico.BOM_ESTADO,
        pesoQuilogramas: "1.470",
        loteId: "33333333-3333-4333-8333-333333333333",
        posicaoNoLote: 1,
        statusRastreamento: StatusRastreamento.AGUARDANDO_DESMONTE
      },
      {
        id: "55555555-5555-4555-8555-555555555552",
        codigoBarrasInterno: "EQ-MN-000002",
        tipo: TipoEquipamento.MONITOR,
        marca: "Dell",
        modelo: "P2419H",
        anoFabricacao: 2020,
        estadoFisico: EstadoFisico.DANIFICADO_LEVE,
        pesoQuilogramas: "3.250",
        loteId: "33333333-3333-4333-8333-333333333333",
        posicaoNoLote: 2,
        statusRastreamento: StatusRastreamento.MATERIAL_RECICLAVEL
      },
      {
        id: "55555555-5555-4555-8555-555555555553",
        codigoBarrasInterno: "EQ-PC-000003",
        tipo: TipoEquipamento.COMPUTADOR_MESA,
        marca: "Dell",
        modelo: "OptiPlex 7090",
        anoFabricacao: 2021,
        estadoFisico: EstadoFisico.USADO_MODERADO,
        pesoQuilogramas: "8.100",
        loteId: "44444444-4444-4444-8444-444444444444",
        posicaoNoLote: 1,
        statusRastreamento: StatusRastreamento.EM_TRIAGEM
      }
    ];

    for (const equipamento of equipamentos) {
      await tx.equipamento.upsert({
        where: { id: equipamento.id },
        update: {},
        create: equipamento
      });
    }

    const movimentacoes = [
      {
        id: "66666666-6666-4666-8666-666666666661",
        equipamentoId: equipamentos[0]!.id,
        dataHora: new Date("2026-10-02T09:00:00.000Z"),
        origem: "Recebimento",
        destino: "Triagem",
        responsavel: "operador",
        observacao: "Entrada registrada para inspeção"
      },
      {
        id: "66666666-6666-4666-8666-666666666662",
        equipamentoId: equipamentos[0]!.id,
        dataHora: new Date("2026-10-02T11:30:00.000Z"),
        origem: "Triagem",
        destino: "Aguardando desmonte",
        responsavel: "gestor",
        observacao: "Triagem concluída; estado físico preservado"
      },
      {
        id: "66666666-6666-4666-8666-666666666663",
        equipamentoId: equipamentos[1]!.id,
        dataHora: new Date("2026-10-03T14:15:00.000Z"),
        origem: "Recebimento",
        destino: "Material reciclável",
        responsavel: "operador",
        observacao: "Tela apresenta linhas e manchas"
      }
    ];

    for (const movimentacao of movimentacoes) {
      await tx.movimentacao.upsert({
        where: { id: movimentacao.id },
        update: {},
        create: movimentacao
      });
    }

    await tx.credencial.upsert({
      where: { usuario: adminUsuario },
      update: { hashSenha, salt: senhaSalt },
      create: {
        usuario: adminUsuario,
        hashSenha,
        salt: senhaSalt,
        papel: PapelUsuario.ADMINISTRADOR
      }
    });
  });

  console.info("Seed GreenCode concluído: organizações, lotes, equipamentos, movimentações e administrador de desenvolvimento criados/confirmados.");
}

seed()
  .catch((error: unknown) => {
    console.error("Falha ao executar seed GreenCode:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
