# Desvios pendentes de ADR

> **Este arquivo não é uma ADR.** 

## Situação

- **10/11/2026, em sala:** a equipe do T3 acordou os desvios abaixo com a equipe autora da arquitetura (Daniel Santana, Davi Guimarães, Gabriel Barreto e Leone Vicentine).
- **Registro do acordo:** Issue "Desvios de implementação acordados com o Grupo 4 (10/11/2026)" neste repositório.
- **10/11/2026, :** escrever e commitar as ADRs correspondentes e atualizar o status das ADRs do T2 afetadas.

## Pontos acordados

| Na arquitetura do T2 | Na implementação do T3 | ADR do T2 afetada | ADR nova prevista |
|---|---|---|---|
| Amazon SQS + DLQ | ElasticMQ | ADR-002, ADR-005 | ADR-006 |
| ECS Fargate + ALB | Docker Compose + Nginx | ADR-005 | ADR-006 |
| S3 Object Lock | RustFS com Object Lock (acordado como MinIO; ver abaixo) | ADR-003 | ADR-006 |
| Amazon SES | Mailpit | — | ADR-006 |
| Amazon Cognito | JWT próprio | ADR-001 | ADR-007 |
| AWS KMS | Chave em variável de ambiente | ADR-001 | ADR-007 |
| ACT ICP-Brasil (RFC 3161) | FreeTSA (RFC 3161) | ADR-003 | ADR-008 |
| Contêiner efêmero por captura | Navegador novo por sessão no worker | ADR-001 | ADR-009 |
| (não definido no T2) | HTTP entre serviços para a reserva; fila para a captura | — | ADR-010 |

## Anotados durante a implementação

Ao encontrar algo que precise mudar na arquitetura, anote aqui (data, quem, o quê) para levar à próxima aula.

| Data | Quem | Ponto |
|---|---|---|
| 10/11/2026 | Cauã | A MinIO tirou as imagens públicas do Docker Hub e do quay.io em 2026. O armazenamento local passa a ser o RustFS (mesma API do S3, com Object Lock). Avisar o Grupo 4 na Issue e registrar na ADR-006 em 12/11. |
