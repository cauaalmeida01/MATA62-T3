# Contratos entre os serviços

> **Proposta para revisão do grupo.** Cada um confere a parte do seu serviço antes de abrir a branch. Mudou algum contrato depois? Atualize este arquivo no mesmo pull request.

Os serviços e componentes seguem o documento do Grupo 4 (`docs/arquitetura/Documento_Arquitetural_T2_Grupo4.pdf`). Os números entre parênteses são os componentes desse documento.

## 1. Regras gerais

- O front só fala com o Nginx (`http://localhost:8080`), que encaminha as **rotas públicas**.
- Os serviços conversam entre si pelas **rotas internas** `/api/internal/*`, direto pela rede do Docker. O Nginx não expõe essas rotas.
- Todas as rotas usam o prefixo `/api`. Todo serviço HTTP responde `GET /api/health`.
- **Banco compartilhado** (ADR-005 do T2), com **um esquema PostgreSQL por serviço**. Nenhum serviço lê ou escreve no esquema de outro: precisou de um dado de outro serviço, chama a rota dele.
- Regra de negócio não lança erro HTTP: lança um erro de domínio (`libs/compartilhado/src/erros`), e o filtro comum converte (seção 5).

## 2. Rotas públicas (passam pelo Nginx)

Todas, menos cadastro e login, exigem `Authorization: Bearer <token>` e só devolvem dados do próprio usuário.

| Método e rota | Serviço | REQ | O que faz |
|---|---|---|---|
| `POST /api/contas` | contas-api | REQ01 | `{ nome, email, senha, cpf, tipo: "ADVOGADO" \| "COMUM", oab?, telefone? }`; OAB obrigatória para advogado. Formato usado pelo front: conferir com o papel A |
| `POST /api/sessoes` | contas-api | REQ03 | Login: devolve `{ token, expiraEm }` |
| `DELETE /api/sessoes/atual` | contas-api | REQ04 | Logout: revoga o token atual |
| `GET /api/creditos/saldo` | creditos-api | — | `{ disponivel, reservado }` |
| `POST /api/solicitacoes` | registro-api | REQ08 | `{ url, titulo, modo: "TELA" }` → `202 { solicitacaoId, status: "PENDENTE" }` |
| `GET /api/solicitacoes/:id` | registro-api | REQ08 | Status: `PENDENTE`, `PROCESSANDO`, `CONCLUIDA` ou `FALHOU` |
| `GET /api/registros` | relatorios-api | REQ12 | Lista os registros concluídos do usuário, mais novos primeiro: `[{ id, url, titulo, inicio, fim, carimbo: { fonte, horario }, criadoEm }]` |
| `GET /api/registros/:id` | relatorios-api | REQ13 | Os campos da lista + `solicitacaoId`, `evidenciaId`, `manifestoSha256`, `arquivos: [{ nome, tipo, sha256, tamanhoBytes }]`. Registro de outro usuário responde `404` |

## 3. Rotas internas (só entre serviços)

| Método e rota | Serviço | Quem chama | Corpo e resposta |
|---|---|---|---|
| `POST /api/internal/carteiras` | creditos-api | contas-api, no cadastro | `{ userId }` → cria a carteira com `CREDITOS_INICIAIS` |
| `POST /api/internal/reservas` | creditos-api | registro-api | `{ userId, solicitacaoId, quantidade: 1 }` → `201 { reservaId }`; sem saldo → `402 CREDITOS_INSUFICIENTES` |
| `POST /api/internal/reservas/:id/efetivar` | creditos-api | relatorios-api | `200`; se já efetivada → `200` (idempotente); se liberada → `409` |
| `POST /api/internal/reservas/:id/liberar` | creditos-api | captura-worker (DLQ) e reconciliação | `200`; se já liberada → `200`; se efetivada → `409` |
| `POST /api/internal/evidencias` | evidencia-api | captura-worker | `multipart/form-data`: `metadados` (JSON abaixo) + `arquivos[]` → `201` com o pacote selado |
| `POST /api/internal/registros/:solicitacaoId/conclusao` | relatorios-api | captura-worker | `{ userId, reservaId, url, titulo, inicio, fim, pacote }` → `201 { registroId }`; repetida → `200` com o mesmo `registroId` |

Metadados enviados com as evidências:

```json
{
  "solicitacaoId": "uuid",
  "userId": "uuid",
  "url": "https://exemplo.com/post",
  "inicio": "2026-11-12T13:00:00.000Z",
  "fim": "2026-11-12T13:01:10.000Z"
}
```

Pacote selado devolvido pela evidencia-api:

```json
{
  "evidenciaId": "uuid",
  "manifestoSha256": "hex",
  "carimbo": { "fonte": "FREETSA", "horario": "2026-11-12T13:01:11Z", "tokenBase64": "..." },
  "arquivos": [
    { "nome": "tela-1.png", "tipo": "TELA", "sha256": "hex", "tamanhoBytes": 123456, "chave": "evidencias/<id>/tela-1.png" }
  ]
}
```

`carimbo.fonte` é `FREETSA` ou `RELOGIO_LOCAL`, quando a FreeTSA não responde. O relatório precisa mostrar qual foi usada.

## 4. Fila de captura (ElasticMQ, API do SQS)

- Fila `captura`: depois de **3 recebimentos sem confirmação**, a mensagem vai sozinha para `captura-dlq` (`infra/elasticmq/elasticmq.conf`).
- O worker só apaga a mensagem (confirma) depois que a conclusão respondeu com sucesso.
- O consumidor da `captura-dlq` libera a reserva e marca a solicitação como `FALHOU`.
- O job de reconciliação libera reservas `RESERVADA` há mais de 15 minutos sem solicitação em andamento. Isso cobre a falha entre gravar a solicitação e publicar na fila.

Mensagem publicada pela registro-api:

```json
{
  "versao": 1,
  "solicitacaoId": "uuid",
  "reservaId": "uuid",
  "userId": "uuid",
  "url": "https://exemplo.com/post",
  "titulo": "Post ofensivo",
  "modo": "TELA",
  "solicitadoEm": "2026-11-12T13:00:00.000Z"
}
```

## 5. Autenticação e formato de erro

**Token JWT** (HS256, segredo `JWT_SECRET`, validade `JWT_EXPIRA_EM`), emitido pela contas-api:

| Campo | Conteúdo |
|---|---|
| `sub` | id do usuário |
| `jti` | id único do token, usado no logout |
| `tipo` | `ADVOGADO` ou `COMUM` |
| `iat`, `exp` | emissão e expiração |

A validação fica na biblioteca `compartilhado` (pacote "autorização" da Figura 3 do T2) e roda em cada serviço, como pede a ADR-001 do T2. O logout grava o `jti` em `compartilhado.tokens_revogados`, que a mesma biblioteca consulta.

**Erro**, em todos os serviços:

```json
{ "erro": { "codigo": "CREDITOS_INSUFICIENTES", "mensagem": "Sem créditos disponíveis" }, "caminho": "/api/solicitacoes", "horario": "2026-11-12T13:00:00.000Z" }
```

| Código | HTTP |
|---|---|
| `DADOS_INVALIDOS` | 400 |
| `CREDITOS_INSUFICIENTES` | 402 |
| `ACESSO_NEGADO` | 403 |
| `NAO_ENCONTRADO` | 404 |
| `CONFLITO` | 409 |
| `REGRA_VIOLADA` | 422 |
| `ERRO_INTERNO` | 500 |

## 6. Tabelas por esquema

| Esquema (dono) | Tabela | Colunas principais |
|---|---|---|
| `contas` (contas-api) | `usuarios` | `id`, `nome`, `email` (único), `senha_hash`, `tipo`, `cpf_cifrado`, `cpf_hash` (único), `oab`, `telefone`, `criado_em` |
| `creditos` (creditos-api) | `carteiras` | `user_id` (PK), `disponivel`, `reservado`, `atualizado_em` |
| `creditos` | `reservas` | `id`, `user_id`, `solicitacao_id`, `quantidade`, `status` (`RESERVADA`, `EFETIVADA`, `LIBERADA`), `criada_em`, `encerrada_em` |
| `registro` (registro-api e captura-worker) | `solicitacoes` | `id`, `user_id`, `url`, `titulo`, `modo`, `status`, `reserva_id`, `ultimo_erro`, `criada_em`, `atualizada_em` |
| `evidencia` (evidencia-api) | `evidencias` | `id`, `solicitacao_id`, `manifesto_sha256`, `carimbo_fonte`, `carimbo_horario`, `carimbo_token`, `criada_em` |
| `evidencia` | `arquivos` | `id`, `evidencia_id`, `nome`, `tipo`, `sha256`, `tamanho_bytes`, `chave` |
| `relatorios` (relatorios-api) | `registros` | `id`, `solicitacao_id` (único), `user_id`, `reserva_id`, `url`, `titulo`, `inicio`, `fim`, `evidencia_id`, `manifesto_sha256`, `carimbo_fonte`, `carimbo_horario`, `criado_em`; somente inclusão |
| `relatorios` | `registro_arquivos` | `id`, `registro_id`, `nome`, `tipo`, `sha256`, `tamanho_bytes`, `chave`; cópia dos arquivos do pacote selado, para o REQ13 não depender da evidencia-api |
| `compartilhado` (biblioteca) | `tokens_revogados` | `jti` (PK), `expira_em` |
| `compartilhado` (biblioteca) | `trilha_auditoria` | `id`, `user_id`, `acao`, `entidade_id`, `dados` (JSON), `hash_anterior`, `hash` (único), `criado_em`; somente inclusão |

**ORM e migrações: Prisma 6.** Cada serviço tem `apps/<serviço>/prisma/schema.prisma`, com o cliente gerado em `node_modules/.prisma/<serviço>` e uma URL própria (`DATABASE_URL_<SERVIÇO>`, terminada em `?schema=<esquema>`), para que a tabela `_prisma_migrations` de cada um fique no próprio esquema. As migrações rodam ao subir o contêiner (`infra/docker/iniciar.sh`). Exemplo pronto: relatorios-api.
