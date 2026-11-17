# Desvios da arquitetura do T2

> **Este arquivo não é uma ADR.** As ADRs estão em [`docs/adr/`](adr/README.md). Aqui fica o resumo dos desvios e os pontos que surgirem daqui em diante.

## Situação

- **10/11/2026, em sala:** a equipe do T3 acordou os desvios abaixo com a equipe autora da arquitetura (Daniel Santana, Davi Guimarães, Gabriel Barreto e Leone Vicentine).
- **Registro do acordo:** Issue "Desvios de implementação acordados com o Grupo 4 (10/11/2026)" neste repositório.
- **16/11/2026:** ADR-006 a ADR-010 escritas e commitadas, e o status das ADRs do T2 atualizado em `ADR's.md`. A sessão supervisionada de 12/11 não aconteceu, e o professor autorizou registrar as ADRs fora da sala.

## Pontos acordados

| Na arquitetura do T2 | Na implementação do T3 | ADR do T2 afetada | ADR do T3 |
|---|---|---|---|
| Amazon SQS + DLQ | ElasticMQ | ADR-002, ADR-005 | [ADR-006](adr/ADR-006-infraestrutura-local.md) |
| ECS Fargate + ALB | Docker Compose + Nginx | ADR-005 | [ADR-006](adr/ADR-006-infraestrutura-local.md) |
| S3 Object Lock | RustFS com Object Lock (acordado como MinIO; ver abaixo) | ADR-003 | [ADR-006](adr/ADR-006-infraestrutura-local.md) |
| Amazon SES | Mailpit | — | [ADR-006](adr/ADR-006-infraestrutura-local.md) |
| Amazon Cognito | JWT próprio | ADR-001 | [ADR-007](adr/ADR-007-autenticacao-propria.md) |
| AWS KMS | Chave em variável de ambiente | ADR-001 | [ADR-007](adr/ADR-007-autenticacao-propria.md) |
| ACT ICP-Brasil (RFC 3161) | FreeTSA (RFC 3161) | ADR-003 | [ADR-008](adr/ADR-008-carimbo-freetsa.md) |
| Contêiner efêmero por captura | Navegador novo por sessão no worker | ADR-001 | [ADR-009](adr/ADR-009-isolamento-da-captura.md) |
| (não definido no T2) | HTTP entre serviços para a reserva; fila para a captura | — | [ADR-010](adr/ADR-010-comunicacao-entre-servicos.md) |

## Anotados durante a implementação

Ao encontrar algo que precise mudar na arquitetura, anote aqui (data, quem, o quê) e combine com o Grupo 4 antes de escrever a ADR.

| Data | Quem | Ponto |
|---|---|---|
| 10/11/2026 | Cauã | A MinIO tirou as imagens públicas do Docker Hub e do quay.io em 2026. O armazenamento local passa a ser o RustFS (mesma API do S3, com Object Lock). Grupo 4 avisado na Issue #1; registrado na ADR-006. |
