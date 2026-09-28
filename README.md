# GreenCode AV1

## Execução

```text
npm install
npm test
npm run dev
npm start
```

Na primeira execução, o sistema solicita o usuário e a senha do primeiro administrador. A configuração é criada em `dados/`.

## Arquitetura de segurança

A CLI chama serviços de aplicação. Os serviços validam regras de negócio e usam `RepositorioArquivo` para persistir dados. O repositório cifra os conteúdos antes da gravação e usa arquivo temporário seguido de renomeação para reduzir o risco de escrita parcial.

A autenticação compara o hash SHA-256 da senha combinada com um salt aleatório. O salt é armazenado junto da credencial; a senha original não é armazenada.

## Criptografia

Os arquivos de persistência usam AES-256-GCM. Cada gravação utiliza um IV aleatório e uma tag de autenticação. A tag permite detectar alteração ou corrupção do conteúdo durante a decifragem.

A chave é gerada com `randomBytes(32)` durante o provisionamento. Nesta versão acadêmica, ela é mantida em `dados/chave-mestre.txt` para permitir a reinicialização do programa. Em produção, esse arquivo deveria ser protegido por um mecanismo externo de gerenciamento de segredos.

## Sessões

Cada login cria um token aleatório com validade inicial de 30 minutos. A validação do token renova a expiração por mais 30 minutos, representando expiração após 30 minutos de inatividade. As sessões são persistidas em `dados/sessoes.json` e recarregadas na inicialização; o logout remove a sessão ativa.

## Regras de negócio implementadas

- CNPJ com 14 dígitos e dígitos verificadores válidos.
- CNPJ único entre organizações persistidas.
- Data de entrada não futura e limitada aos últimos 90 dias.
- Equipamento não pode ir para desmonte antes da conclusão da triagem.
- Estados `DANIFICADO_GRAVE` e `INSERVIVEL` exigem justificativa.
- Permissões são associadas aos quatro papéis definidos pela aplicação.
- Journal retém registros por 180 dias e rotaciona acima de 10 MB.
- Reversões do journal executam uma ação de restauração fornecida pelo serviço responsável pela entidade.

## Testes disponíveis

A suíte em `src/testes/fluxo.test.ts` cobre:

- CNPJ válido e inválido;
- data futura;
- cifragem e decifragem AES-256-GCM;
- login e logout;
- permissões por papel;
- provisionamento;
- jornada organização -> lote -> equipamento -> triagem -> movimentação;
- tentativa de desmonte antes da triagem.

Execute com `npm test`.
