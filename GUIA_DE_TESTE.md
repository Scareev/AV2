# Guia de teste — GreenCode AV2

Este guia leva uma pessoa de teste da preparação do banco até os principais fluxos da SPA e da API. Use um banco local de desenvolvimento; não aponte o seed para um banco com dados importantes. O seed atualiza a senha do usuário administrador a cada execução.

## 1. Pré-requisitos

- Node.js 24 recomendado e npm.
- PostgreSQL instalado e iniciado.
- Acesso ao projeto em `/home/heitor/AV2`.

No Ubuntu, confira o serviço PostgreSQL:

```sh
pg_isready
```

Se estiver parado, inicie-o (o número da versão pode variar):

```sh
sudo pg_ctlcluster 16 main start
pg_isready
```

O resultado esperado é `accepting connections`.

## 2. Instale dependências e configure o banco

No diretório do projeto:

```sh
cd /home/heitor/AV2
npm ci
npm ci --prefix web
```

Crie `.env` somente se ainda não existir e abra-o para edição:

```sh
cp -n .env.example .env
nano .env
```

Configure `DATABASE_URL`, `JWT_SECRET` e `SEED_ADMIN_PASSWORD`:

- `DATABASE_URL` deve usar o usuário e a senha PostgreSQL criados abaixo.
- `JWT_SECRET` precisa ter pelo menos 32 caracteres e não pode começar por `change-this`.
- `SEED_ADMIN_PASSWORD` precisa ter pelo menos 12 caracteres.
- Mantenha uma única linha para cada variável. O arquivo `.env` é local e ignorado pelo Git; não o envie junto com o projeto.

Crie o usuário e o banco de desenvolvimento. Abra a sessão administrativa:

```sh
sudo -u postgres psql
```

No prompt `postgres=#`, execute **uma linha por vez**. Se o usuário já existe, não repita o `CREATE ROLE`:

```sql
CREATE ROLE greencode LOGIN;
```

Defina a senha do usuário PostgreSQL. Quando solicitado, digite a senha que será usada na `DATABASE_URL` do `.env`:

```text
\password greencode
```

Depois que o prompt `postgres=#` voltar, crie o banco:

```sql
CREATE DATABASE greencode OWNER greencode;
```

Se o banco já existir, ignore o erro de duplicidade. Saia do psql:

```text
\q
```

A URL local tem este formato; substitua `SENHA_DO_BANCO` pelo valor escolhido:

```dotenv
DATABASE_URL=postgresql://greencode:SENHA_DO_BANCO@localhost:5432/greencode?schema=public
```

Não cole vários comandos juntos no prompt de senha do psql: durante `\password`, linhas seguintes podem ser interpretadas como argumentos da senha.

## 3. Gere o Prisma Client, migre e carregue dados

Com o `.env` salvo e o PostgreSQL ativo:

```sh
npm run db:generate
npm run db:deploy
npm run db:seed
```

O seed cria dados de demonstração e o usuário `admin` (ou o valor de `SEED_ADMIN_USERNAME`). Para consultar a senha de login definida localmente:

```sh
grep '^SEED_ADMIN_PASSWORD=' .env
```

Use o valor apenas no seu ambiente local; não o cole em mensagens ou chamados.

## 4. Inicie a aplicação

Abra dois terminais no diretório `/home/heitor/AV2`.

Terminal 1 — API:

```sh
npm run dev
```

Terminal 2 — SPA:

```sh
npm run dev:web
```

Abra `http://localhost:5173` e entre com `admin` e a senha do seed. A API fica em `http://localhost:3000`; a interface encaminha chamadas pelo proxy `/api`.

## 5. Verificação rápida

1. Abra `http://localhost:3000/health`. O esperado é `{"status":"ok"}`.
2. Abra `http://localhost:3000/docs` e confirme que o Swagger carrega.
3. Entre na SPA. Confira que o painel mostra dados do seed.
4. Abra **Organizações** e consulte os registros de demonstração.
5. Crie uma organização de teste com CNPJ válido e exclusivo; consulte, edite e desative-a.
6. Na organização, crie e consulte um contrato; edite-o e encerre-o. O contrato encerrado deve continuar visível no histórico.
7. Crie um lote associado a uma organização ativa; consulte seus detalhes e equipamentos.
8. Crie um equipamento no lote, edite seus dados antes da triagem e consulte a versão atual.
9. Teste o cancelamento de um lote recém-criado antes de iniciar a triagem. A API só permite cancelar lote recebido antes da triagem.
10. Na lista de equipamentos, teste edição, triagem e cancelamento de um item de teste apropriado.
11. Abra **Relatórios** e filtre equipamentos por um status válido.

Use registros de teste identificáveis e não apague dados do seed. O seed é repetível por ID, mas atualiza a senha do administrador configurado.

## 6. Teste a API pelo Swagger

O Swagger facilita verificar operações que a SPA não apresenta como ações, como alteração de estado físico, registro de movimentação, correção e estorno.

1. Em `/docs`, execute `POST /auth/login` com o usuário e a senha do seed.
2. Copie o token retornado.
3. Clique em **Authorize** e informe `Bearer <token>`.
4. Abra uma rota e use **Try it out**. Consulte primeiro o registro para obter seu `id` e `version`.
5. Para testar controle de concorrência, atualize um registro com a versão atual e repita a mesma alteração com a versão antiga. A segunda requisição deve responder `409 Conflict`.
6. Para movimentações, registre um evento, consulte o histórico para obter o ID original e então teste uma correção ou estorno. Os eventos derivados devem preservar o original.

Os corpos e valores aceitos aparecem nos schemas de cada operação do Swagger. Todas as alterações versionadas precisam enviar a versão observada; no cadastro de equipamento, envie também `versionLote`.

## 7. Papéis e autorização

O seed cria apenas a credencial administradora. A matriz de permissões da API é:

| Papel | Áreas |
| --- | --- |
| `ADMINISTRADOR` | Organizações, lotes, equipamentos e relatórios. |
| `OPERADOR_CADASTRO` | Organizações, lotes e equipamentos. |
| `GESTOR_ALMOXARIFADO` | Lotes, equipamentos e rastreabilidade. |
| `AUDITOR` | Relatórios e rastreabilidade. |

Não há tela para criar usuários de outros papéis. Para testar a matriz completa, prepare credenciais de teste no banco por um procedimento de desenvolvimento controlado; não reutilize contas ou senhas de produção. A API é a autoridade de autorização: uma tentativa sem permissão deve responder `403`.

## 8. Verificações automatizadas

Após instalar as dependências, execute:

```sh
npm run db:generate
npx prisma validate
npm run typecheck
npm run build
npm run build:web
npm test
```

`npm test` cobre as regras de domínio, validação de CNPJ e permissões. Testes com PostgreSQL devem usar um banco dedicado de desenvolvimento/teste.

## Problemas comuns

| Sintoma | O que conferir |
| --- | --- |
| `P1000` no Prisma | Usuário/senha da `DATABASE_URL` não correspondem à senha do papel PostgreSQL. Use `\password greencode` e sincronize a URL. |
| `P1003` ou banco inexistente | Crie `greencode` com `CREATE DATABASE greencode OWNER greencode;`. |
| Erro sobre `JWT_SECRET` | Troque o placeholder por um segredo local com pelo menos 32 caracteres. |
| Seed rejeita senha | `SEED_ADMIN_PASSWORD` deve ter pelo menos 12 caracteres e não pode ser o placeholder. |
| `EADDRINUSE` na porta 3000 | Outra API já usa a porta; pare-a ou configure outra `PORT` no `.env`. |
| `401` na API | Faça login novamente e use um token válido no cabeçalho Bearer. |
| `403` na API | O papel autenticado não tem permissão para aquela operação. |
| `409` ao editar | O registro mudou desde a leitura; atualize a lista e tente de novo com a versão atual. |
| `npm ci` com `ENOTFOUND` | O ambiente não consegue resolver `registry.npmjs.org`; restaure o acesso à rede e repita a instalação. |

Não envie `.env`, tokens JWT, senhas ou dumps do banco ao reportar um erro. Compartilhe o comando executado, a mensagem de erro e os passos para reproduzi-lo, removendo credenciais.
