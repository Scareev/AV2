# GreenCode AV2

Aplicação monolítica em evolução para API REST com Fastify, persistência PostgreSQL via Prisma e interface SPA em React + TypeScript + Vite.

## Requisitos

- Node.js 24 ou compatível com as dependências instaladas.
- PostgreSQL acessível pela variável `DATABASE_URL`.

## Configuração local

1. Instale as dependências da API com `npm install` e as do site com `npm install --prefix web`.
2. Copie `.env.example` para `.env` e configure `DATABASE_URL`, `JWT_SECRET` (mínimo 32 caracteres) e `SEED_ADMIN_PASSWORD` (mínimo 12 caracteres). A senha seed não possui valor padrão.
3. Com o PostgreSQL ativo, aplique as migrações com `npm run db:migrate`.
4. Crie os dados de desenvolvimento com `npm run db:seed`. O usuário administrador padrão é `admin`; pode ser alterado por `SEED_ADMIN_USERNAME`.
5. Inicie a API com `npm run dev`.
6. Em outro terminal, inicie o site com `npm run dev:web` e acesse o endereço local informado pelo Vite. O proxy `/api` encaminha chamadas à API em `http://localhost:3000`.

O seed pode ser executado novamente: usa identificadores fixos e operações upsert. A senha do administrador configurada no ambiente é atualizada a cada execução do seed.

## Comandos disponíveis

- `npm run dev`: executa o servidor em modo de desenvolvimento.
- `npm run build`: gera a versão de produção da API em `dist/`.
- `npm start`: inicia a versão compilada.
- `npm run typecheck`: verifica os tipos TypeScript.
- `npm test`: executa os testes unitários de regras, CNPJ e permissões.
- `npm run dev:web`: inicia a SPA React + Vite para desenvolvimento.
- `npm run build:web`: compila e empacota a SPA em `web/dist/`.
- `npm run db:generate`: gera o Prisma Client.
- `npm run db:migrate`: cria/aplica migrações no banco de desenvolvimento.
- `npm run db:deploy`: aplica migrações existentes em ambiente de deploy.
- `npm run db:seed`: popula o banco com dados iniciais representativos.
- `npm run db:studio`: abre a interface visual do Prisma para inspecionar dados.

O login da API é `POST /auth/login`, com JSON `{ "usuario": "admin", "senha": "..." }`. A resposta contém um token Bearer JWT válido por 30 minutos e os dados públicos do usuário. Envie o token no cabeçalho `Authorization: Bearer <token>` para rotas protegidas; os hooks de autenticação e autorização por papel ficam em `src/auth/hooks.ts` para uso pelos controllers. A documentação OpenAPI fica em `/docs` e o endpoint público de saúde em `/health`.
