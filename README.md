# GreenCode AV2

Plataforma monolítica de logística reversa com API REST em Node.js/TypeScript e Fastify, persistência relacional PostgreSQL via Prisma e SPA em React, TypeScript e Vite.

## Comece por aqui

Para instalar, iniciar e testar os fluxos passo a passo, use o [Guia de teste](GUIA_DE_TESTE.md). Ele explica como configurar PostgreSQL e `.env`, entrar na SPA, percorrer os cenários principais e diagnosticar erros comuns. Este README mantém a referência técnica da API e do projeto.

## Requisitos locais

- Node.js 24 recomendado. Prisma 7 e Vite 8 também exigem versões recentes de Node; confira os requisitos indicados pelos pacotes se usar outra versão.
- PostgreSQL acessível para migrações, seed e operações persistidas.
- Dependências da API e da SPA instaladas a partir dos lockfiles.

O PDF da AV2 também solicita compatibilidade com Windows 10 ou superior, Ubuntu 24.04.03 ou superior e distribuições derivadas do Ubuntu. Essa compatibilidade ainda não foi verificada em cada plataforma.

## Instalação e configuração

```sh
npm ci
npm ci --prefix web
cp .env.example .env
```

Edite `.env` antes de iniciar a aplicação:

| Variável | Uso |
| --- | --- |
| `HOST` | Interface de rede do servidor; padrão `0.0.0.0`. |
| `PORT` | Porta HTTP entre 1 e 65535; padrão `3000`. |
| `JWT_SECRET` | Segredo JWT com pelo menos 32 caracteres. Substitua o valor de exemplo por um segredo aleatório local. |
| `CORS_ORIGINS` | Origens permitidas separadas por vírgula; padrão `http://localhost:5173`. |
| `DATABASE_URL` | URL PostgreSQL usada pelo Prisma. |
| `SEED_ADMIN_USERNAME` | Usuário administrador criado pelo seed; padrão `admin`. |
| `SEED_ADMIN_PASSWORD` | Senha do administrador de desenvolvimento, obrigatória para seed e com pelo menos 12 caracteres. Não há senha padrão. |

Gere o Prisma Client e crie/aplique as migrações no banco de desenvolvimento:

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
```

O seed carrega duas organizações, um contrato, dois lotes, equipamentos, movimentações e uma credencial administradora. Usa IDs fixos e `upsert` para que os registros existentes não sejam duplicados. Em cada execução, recalcula o hash e atualiza a senha da credencial configurada. Execute-o somente em um banco de desenvolvimento apropriado.

## Executar

Em um terminal, inicie a API:

```sh
npm run dev
```

Em outro terminal, inicie o site:

```sh
npm run dev:web
```

Abra a URL informada pelo Vite, normalmente `http://localhost:5173`. O proxy `/api` encaminha as chamadas à API em `http://localhost:3000`. Para alterar o destino de desenvolvimento, ajuste `web/vite.config.ts`.

O servidor lê `HOST` e `PORT` do ambiente, fecha o Fastify e desconecta o Prisma ao receber `SIGINT` ou `SIGTERM`. O endpoint público de saúde é `GET /health`.

## Autenticação e papéis

Faça login em `POST /auth/login`:

```json
{ "usuario": "admin", "senha": "sua-senha-local" }
```

A resposta contém um JWT válido por 30 minutos e os dados públicos do usuário. Envie o token em `Authorization: Bearer <token>` nas rotas protegidas. O site mantém token e identidade em `sessionStorage` até o logout ou o fechamento da sessão do navegador.

As permissões aplicadas pela API são:

| Papel | Operações disponíveis |
| --- | --- |
| `ADMINISTRADOR` | Organizações, lotes, equipamentos e relatórios. |
| `OPERADOR_CADASTRO` | Organizações, lotes e equipamentos. |
| `GESTOR_ALMOXARIFADO` | Lotes, equipamentos e rastreabilidade. |
| `AUDITOR` | Relatórios e rastreabilidade. |

A SPA oculta navegação e ações conforme o papel; a autorização efetiva continua nos hooks da API.

## API e fluxos principais

Swagger UI: `/docs`. O documento OpenAPI JSON é servido em `/docs/json`.

Rotas principais protegidas por JWT:

| Recurso | Rotas e comportamento |
| --- | --- |
| Organizações | `GET/POST /organizacoes`, `GET/PATCH/DELETE /organizacoes/:id`. A exclusão lógica/desativação exige `?version=N`; o GET de lista retorna organizações ativas. |
| Contratos | `GET/POST /organizacoes/:id/contratos`, `PATCH/DELETE /organizacoes/:id/contratos/:contratoId` e `PATCH /organizacoes/:id/contrato/renovacao`. O encerramento recebe `{ "version": N, "motivo": "..." }` e preserva o registro. |
| Lotes | `GET/POST /lotes`, `GET/PATCH/DELETE /lotes/:id`, `PATCH /lotes/:id/triagem`. A consulta por período exige `dataInicio` e `dataFim`; `incluirCancelados=true` inclui cancelados. A criação pode receber equipamentos no mesmo pedido e persiste o conjunto atomicamente. |
| Equipamentos | `GET/POST /equipamentos`, `GET/PATCH/DELETE /equipamentos/:id`, `PATCH /equipamentos/:id/estado-fisico`, `POST /equipamentos/:id/triagem` e `GET /equipamentos/:id/movimentacoes`. Atualizações de dados são permitidas antes da triagem e de movimentações. |
| Eventos de movimentação | `POST /equipamentos/:id/movimentacoes`, `POST /equipamentos/:id/movimentacoes/:movimentacaoId/correcoes` e `/estornos`. Correções e estornos criam eventos relacionados e não apagam o original. |
| Relatórios | `GET /relatorios/equipamentos?status=...`, `GET /relatorios/organizacoes/:id/lotes?inicio=...&fim=...` e `GET /relatorios/financeiro?inicio=...&fim=...`. |

Os JSON Schemas das rotas validam os parâmetros e alimentam a documentação OpenAPI. O formato aceito para enumerações está declarado no schema Prisma e nos schemas das rotas.

### Versionamento otimista e respostas de erro

As respostas de entidades versionadas incluem `version`. Envie a versão lida em qualquer atualização, transição de estado, triagem, cancelamento ou registro de evento que altere o agregado. Por exemplo, a atualização de uma organização envia `PATCH /organizacoes/:id` com `{ "version": 2, "email": "novo@example.com" }`. O cadastro de um equipamento envia `versionLote` para confirmar a versão atual do lote.

Se o registro tiver mudado desde a leitura, a API responde `409 Conflict` com uma mensagem para recarregar os dados. Violações de unicidade também respondem `409`. As demais respostas de domínio e validação usam o formato `{ "erro": "mensagem" }`.

Operações compostas usam transações Prisma: criação de lote com equipamentos, alterações de estado com movimentação, conclusão de triagem com evento e cancelamento de lote com os equipamentos associados.

## Banco de dados e migrações

O schema relacional está em `prisma/schema.prisma`. Ele define `Organizacao`, `Contrato`, `Lote`, `Equipamento`, `Movimentacao` e `Credencial`, com PostgreSQL, UUIDs, enums, chaves estrangeiras e unicidade para CNPJ, código de barras e usuário. A relação entre organização e contrato é opcional e um-para-um no schema atual.

As migrações versionadas ficam em `prisma/migrations/`:

1. `20261017120000_init`: estrutura inicial.
2. `20261026190000_add_optimistic_versions`: versões iniciadas em zero, sem remover registros.
3. `20261026210000_add_soft_cancellation`: encerramento de contratos e cancelamento de lotes/equipamentos com motivo.
4. `20261026220000_add_movement_events`: tipos de evento e vínculo entre correções/estornos e a movimentação original.

Use `npm run db:migrate` em desenvolvimento e `npm run db:deploy` para aplicar migrações existentes em um ambiente preparado. Não edite ou apague dados úteis para aplicar a atividade.

## Comandos

| Comando | Ação |
| --- | --- |
| `npm run dev` | API com recarga em desenvolvimento. |
| `npm run build` / `npm start` | Compilar e iniciar a API de produção. |
| `npm run typecheck` | Verificar tipos da API. |
| `npm test` | Testes unitários disponíveis de regras, CNPJ e permissões. |
| `npm run dev:web` | Iniciar a SPA. |
| `npm run build:web` | Verificar tipos e empacotar a SPA em `web/dist/`. |
| `npm run db:generate` | Gerar Prisma Client. |
| `npm run db:migrate` / `npm run db:deploy` | Criar/aplicar migrações de desenvolvimento ou aplicar migrações existentes. |
| `npm run db:seed` | Carregar os dados e a credencial de desenvolvimento. |
| `npm run db:studio` | Abrir o Prisma Studio. |

## Estado de verificação

Em 26/10/2026, passaram `npm run db:generate`, `npm run typecheck`, `npm run build`, `npm run build:web` e `npx prisma validate`. O usuário informou que iniciou e testou manualmente a aplicação no ambiente local; a cobertura específica desses testes manuais não foi registrada. A suíte automatizada `npm test` e a concorrência com múltiplas requisições ainda precisam ser verificadas. A compatibilidade com Windows e com todas as versões de Ubuntu indicadas no PDF também não foi conferida.

### Revisão dos itens da AV2

| Item do enunciado | Estado | Observação |
| --- | --- | --- |
| API HTTP, SPA e banco relacional PostgreSQL | Parcial | Typecheck e builds passaram; o usuário relatou teste manual básico. A cobertura completa dos fluxos não foi registrada. |
| Camadas Controller–Service–Repository | Atendido no código | Controllers delegam regras aos services e persistência aos repositories. |
| Modelos e relacionamentos Prisma | Atendido no código | Schema validado e Prisma Client gerado; o usuário iniciou a aplicação com banco local. |
| Autenticação JWT, hash de senha e papéis | Parcial | Implementados; teste manual relatado, mas a matriz completa de papéis não foi documentada como exercitada. |
| Transações em operações compostas | Parcial | Transações estão implementadas; rollback e concorrência ainda não foram exercitados de forma automatizada. |
| Versionamento otimista | Parcial | Campos, migração aditiva e conflitos `409` estão implementados; falta verificar concorrência com duas requisições. |
| Seed, unicidade e validações | Parcial | Seed e restrições estão definidos; verificar reexecução do seed e conflitos de unicidade com o guia. |
| Documentação OpenAPI | Atendido no código | Schemas Fastify estão declarados e alimentam `/docs` e `/docs/json`; teste manual da documentação pode ser feito conforme o guia. |
| Porta configurável e encerramento gracioso | Parcial | Configuração por `HOST`/`PORT` e handlers de `SIGINT`/`SIGTERM` implementados; encerramento gracioso não foi exercitado. |
| Fluxos funcionais da API e da SPA | Parcial | Builds passaram e o usuário relatou execução manual; cobertura dos fluxos e papéis ainda precisa ser registrada. |
| Compatibilidade com Windows 10+, Ubuntu 24.04.03+ e derivados | Parcial | Não verificada nessas plataformas. |

Nenhum requisito foi declarado plenamente conforme quando a verificação necessária depende de dependências ausentes, banco acessível ou execução em outra plataforma.
