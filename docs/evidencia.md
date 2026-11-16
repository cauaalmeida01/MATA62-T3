# Serviço Evidência — papel C (Pedro)

Implementa `POST /api/internal/evidencias`, conforme `docs/contratos.md`, §3.
A API tem porta Docker 3004, mas o endpoint interno deve ser chamado pelo `captura-worker` com o segredo `EVIDENCIA_INTERNAL_KEY`. O Nginx não publica a rota.

## Execução

```bash
cp .env.example .env           # somente se ainda não existir .env
# Se .env já existir, adicione EVIDENCIA_INTERNAL_KEY com o MESMO valor nos serviços.
docker compose up --build
curl http://localhost:3004/api/health
npm test -- --runInBand
npm run build
```

O RustFS é iniciado pelo Compose em `http://localhost:9001`; o `s3-init` cria o bucket `evidencias` com Object Lock (GOVERNANCE, 1 dia). O nome de objeto começa em `evidencias/<evidenciaId>/`. Metadados e hashes ficam em `evidencia.evidencias` e `evidencia.arquivos`. Eventos de selagem ficam em `compartilhado.trilha_auditoria`, em cadeia de hashes, na mesma transação do pacote.

## Operação

Entrada: `multipart/form-data`, campo texto `metadados` JSON com `solicitacaoId`, `userId`, `url`, `inicio`, `fim`; arquivos repetidos no campo `arquivos`, PNG (`image/png`), HAR (`application/json`) ou HTML (`text/html`). Até 10 arquivos, 25 MiB por arquivo. Nome simples sem `/` ou `..`. O worker já gera `screenshot.png` e `rede.har`, e foi ajustado para enviar `x-internal-api-key`.

Saída HTTP 201:

```json
{
  "evidenciaId": "uuid",
  "manifestoSha256": "64 dígitos hexadecimais",
  "carimbo": { "fonte": "FREETSA", "horario": "ISO 8601", "tokenBase64": "..." },
  "arquivos": [
    { "nome": "screenshot.png", "tipo": "TELA", "sha256": "...", "tamanhoBytes": 12345,
      "chave": "evidencias/<evidenciaId>/screenshot.png" }
  ]
}
```

A API consulta o banco por `solicitacaoId` antes da selagem. Uma segunda chamada com a mesma solicitação devolve o pacote original, sem cobrar/armazenar de novo. O índice UNIQUE no banco lida com corridas entre workers.

## Verificabilidade

O serviço calcula SHA-256 do byte a byte dos arquivos. Um `manifesto.json` com metadados e os hashes de cada arquivo é salvo no S3. O SHA-256 desse JSON é a entrada para a FreeTSA. Se a TSA responder, a API extrai o `TimeStampToken` (CMS) e o horário `genTime`, conferindo o `messageImprint` contra o manifesto; guarda o token no banco, no retorno (`tokenBase64`) e em `carimbo.tst` no bucket. Se houver erro ou timeout, usa explicitamente `RELOGIO_LOCAL` **sem token certificado**.

**Limite de segurança importante:** o parser confere a integridade estrutural do token e o `messageImprint`, mas não implementa a validação criptográfica da assinatura CMS ou cadeia de confiança. Para prova jurídica, exporte o token e valide por ferramenta de verificação X.509/RFC 3161 com a CA de confiança configurada. FreeTSA não é uma ACT ICP-Brasil; sua utilização é um desvio acadêmico já documentado em `docs/desvios-pendentes.md`. O fallback `RELOGIO_LOCAL` não oferece certificação temporal.

Em demonstração, nunca apresentar a política de 1 dia `GOVERNANCE` como equivalente a retenção definitiva em modo `COMPLIANCE`. A configuração de longo prazo deve ser tratada em ADR e aprovada pelo grupo.

## Fluxo de camadas / SOLID

- `apresentacao/EvidenciasController`: recebe multipart e verifica chave interna (SRP).
- `dominio/modelos.ts` e `portas.ts`: tipos/contratos de repositório, S3 e carimbo (ISP, DIP).
- `aplicacao/SelarEvidenciaUseCase`: valida a entrada, calcula hashes, coordena carimbo, armazenamento e persistência (SRP, DIP).
- `infra/PostgresEvidenciaRepository`: transações, idempotência e auditabilidade.
- `infra/Rfc3161Carimbador`: abstração do provedor TSA (OCP/LSP: pode ser trocado sem alterar caso de uso).
- `infra/S3ArmazenamentoAdapter`: Signature V4 e PutObject; a retenção padrão é aplicada pelo bucket.
- `libs/infra/auditoria/TrilhaAuditoriaRepository`: escrita compartilhada de eventos com hash encadeado na transação.

## Testes

`apps/evidencia-api/src/evidencia-api.spec.ts`: unidade, validação, SHA-256, manifesto, contrato HTTP, falha S3, Signature V4 e carimbo (inclusive fallback).

`apps/evidencia-api/src/evidencia-postgres.spec.ts`: integração PostgreSQL idempotente e auditoria. Executa se `TEST_DATABASE_URL` estiver definido (CI já tem PostgreSQL e define essa variável). Não usa bucket ou FreeTSA reais: testes do S3 e TSA usam mocks para serem determinísticos.

## Limitações e próximos incrementos

Uploads multipart usam memória e têm limite por arquivo; para grandes vídeos, substituir por streaming. Se falhar o banco depois de fazer PUT, podem restar objetos não referenciados que não devem ser apagados enquanto retidos por Object Lock. Para produção, usar reconciliação de órfãos e validar assinaturas/certificados do TimeStampToken. As rotas internas precisam de TLS/mTLS em rede não confiável; o segredo HTTP cobre a demonstração em Docker local.
