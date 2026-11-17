# ADR-006 — Infraestrutura local equivalente aos serviços da AWS

- **Status:** Aceita
- **Data:** 16/11/2026 (acordada com o Grupo 4 em 10/11/2026)
- **ADRs do T2 afetadas:** ADR-002 (fila), ADR-003 (armazenamento imutável), ADR-005 (implantação)

## Contexto

O Grupo 4 especificou a implantação na AWS: Amazon SQS com DLQ para a captura (ADR-002), S3 Object Lock para as evidências (ADR-003), serviços em contêineres no ECS Fargate atrás de um ALB, RDS PostgreSQL Multi-AZ (ADR-005) e Amazon SES para os e-mails.

O Trabalho III exige "o sistema rodando" e um README com instruções para rodá-lo. Precisa funcionar na máquina de cada integrante e na apresentação, sem conta na AWS, sem custo e sem credenciais compartilhadas entre cinco pessoas.

## Decisão

Rodar tudo com um `docker compose up`, trocando cada serviço gerenciado por um equivalente local com a mesma função:

| No T2 (AWS) | No T3 (local) | Como fica |
|---|---|---|
| Amazon SQS + DLQ | ElasticMQ | Mesma API do SQS. Fila `captura` e fila `captura-dlq`, com envio para a DLQ depois de 3 recebimentos sem confirmação (`infra/elasticmq/elasticmq.conf`) |
| ECS Fargate | Docker Compose | Um contêiner por serviço; o worker escala com `docker compose up --scale captura-worker=3` |
| ALB | Nginx | Porta 8080: serve o front e encaminha só as rotas públicas; `/api/internal/*` responde 404 (`infra/nginx/nginx.conf`) |
| RDS PostgreSQL Multi-AZ | PostgreSQL 16 em um contêiner | Um esquema por serviço, como na ADR-005 |
| S3 Object Lock | RustFS | Mesma API do S3, com Object Lock. O bucket `evidencias` é criado pelo contêiner `s3-init` com retenção padrão GOVERNANCE de 1 dia |
| Amazon SES | Mailpit | Servidor SMTP de teste, já no compose para o serviço de Notificações |

Os adaptadores em `libs/infra` falam as APIs do SQS e do S3. Voltar para a AWS é trocar endpoints e credenciais nas variáveis de ambiente, sem mudar código de domínio.

## Alternativas consideradas

1. **Usar a AWS de verdade (camada gratuita).** Descartada: exige cartão e conta, as credenciais teriam de ser compartilhadas pela equipe, o professor não conseguiria reproduzir o ambiente e o carimbo e o armazenamento continuariam gerando custo.
2. **LocalStack (um contêiner que emula a AWS).** Descartada: concentra tudo num contêiner pesado e com comportamento diferente da AWS em detalhes como Object Lock. Componentes separados deixam claro o papel de cada um.
3. **MinIO no lugar do RustFS.** Era a opção acordada em 10/11, mas as imagens públicas da MinIO deixaram de ser distribuídas (pull negado no Docker Hub e no quay.io durante o desenvolvimento). O RustFS oferece a mesma API do S3 com Object Lock. O Grupo 4 foi avisado na Issue #1.
4. **Kubernetes local (kind, minikube).** Descartada: mais próximo do Fargate, mas exige uma curva de aprendizado e uma configuração que não trazem ganho para o que o trabalho avalia.

## Justificativa

A estrutura definida pelo Grupo 4 continua a mesma: os mesmos serviços, implantados separadamente; a captura desacoplada por uma fila com DLQ; o armazenamento imutável para as evidências; um banco relacional compartilhado com esquema por serviço. Muda só quem fornece cada peça. Como ElasticMQ e RustFS falam as mesmas APIs do SQS e do S3, o código que a implementação escreveu é o mesmo que rodaria na AWS.

## Consequências

**Positivas**
- Qualquer pessoa com Docker sobe o sistema inteiro com dois comandos (`cp .env.example .env` e `docker compose up --build`).
- Sem custo e sem credenciais de nuvem.
- O caminho de volta para a AWS é configuração, não reescrita.

**Negativas**
- Sem alta disponibilidade: o PostgreSQL não tem réplica (Multi-AZ) e nada escala sozinho; o worker escala só com `--scale` manual.
- A retenção GOVERNANCE pode ser removida por um usuário com permissão especial; a ADR-003 pede imutabilidade que nem o administrador consiga quebrar (COMPLIANCE). O prazo de 1 dia é só para a demonstração.
- O Nginx local não usa TLS. Em produção, o tráfego externo precisa de HTTPS, como pede a ADR-001.

## Requisitos e restrições relacionados

- Top 4: Disponibilidade e Confiabilidade (fila com DLQ), Auditabilidade (armazenamento imutável).
- REQ08 e REQ11 (pedido e conclusão da captura passam pela fila).
- Enunciado do T3: sistema rodando e README com instruções.

## Acordo com o Grupo 4

Acordado em sala em 10/11/2026 (Issue #1). A troca de MinIO por RustFS foi comunicada na mesma Issue.
