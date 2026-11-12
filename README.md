# Veridit — Trabalho III (MATA62, Engenharia de Software I, UFBA)

Implementação de parte dos requisitos do **Veridit**, plataforma de registro de conteúdo da internet com valor de prova, seguindo a **arquitetura baseada em serviços** definida no Trabalho II pelo Grupo 4.

- **Arquitetura de origem:** repositório [g-barreto00/MATA62-T2](https://github.com/g-barreto00/MATA62-T2) (do qual este é um fork) e o [documento arquitetural do T2](docs/arquitetura/Documento_Arquitetural_T2_Grupo4.pdf), de Daniel Santana, Davi Guimarães, Gabriel Barreto e Leone Vicentine.
- **Os arquivos do Grupo 4** (`ADR's.md`, `carac_arq.md`, `comp_cand.md`, `diag_comp.md`, `diag_mod.md`) ficam na raiz como vieram. ADRs só são criadas ou alteradas em sala.

## Equipe do T3

| Papel | Integrante |
|---|---|
| A — Contas + Créditos | Davi Araújo |
| B — Registro e Captura | Guilherme Loiola |
| C — Evidência | Pedro |
| D — Registros e Relatórios + Web | João Ferraz |
| E — Infraestrutura, integração, documentação e arquitetura | Cauã Marinho |

## Como rodar

**Pré-requisitos:** Docker Desktop (com Docker Compose) e, para desenvolver fora do Docker, Node.js 22.

```bash
cp .env.example .env
docker compose up --build
```

| O quê | Onde |
|---|---|
| Interface (pelo Nginx) | <http://localhost:8080> |
| Health dos serviços | <http://localhost:3001/api/health> (contas) · 3002 (créditos) · 3003 (registro) · 3004 (evidência) · 3005 (relatórios) |
| RustFS (console das evidências; login com `S3_ACCESS_KEY` e `S3_SECRET_KEY`) | <http://localhost:9001> |
| Mailpit (e-mails enviados) | <http://localhost:8025> |
| ElasticMQ (estatísticas da fila) | <http://localhost:9325> |

Mais capacidade de captura: `docker compose up --scale captura-worker=3`.

### Desenvolvendo um serviço fora do Docker

```bash
npm install
docker compose up postgres elasticmq rustfs s3-init mailpit   # só a infraestrutura
npm run start:dev -- contas-api                                   # o serviço em que você está trabalhando
npm test
```

Fora do Docker, troque nos endereços do `.env` os nomes `postgres`, `elasticmq`, `rustfs`, `mailpit` e `*-api` por `localhost` (com as portas da tabela acima).

## Estrutura

```
apps/
  contas-api/       Serviço Contas (01 Cadastro, 02 Acesso e Sessão)
  creditos-api/     Serviço Créditos e Pagamentos (07 Controle de Créditos)
  registro-api/     Serviço Registro e Captura (09 Solicitação de Registro)
  captura-worker/   Serviço Registro e Captura (10 Captura), consome a fila
  evidencia-api/    Serviço Evidência (11 a 14, interno)
  relatorios-api/   Serviço Registros e Relatórios (15 Conclusão, 18 Consulta)
libs/
  compartilhado/    autorização, auditoria, erros de domínio, health
  infra/            adaptadores: ElasticMQ/SQS, RustFS/S3, SMTP, RFC 3161, PostgreSQL
infra/              configuração do ElasticMQ e do Nginx
docs/               contratos, desvios pendentes e o documento do T2
```

## Como trabalhamos no Git

- A `main` é protegida: entra só por pull request com 1 aprovação.
- Uma branch por frente de trabalho: `feature/contas`, `feature/creditos`, `feature/captura`, `feature/evidencia`, `feature/relatorios`, `feature/web`, `feature/infra`.
- Mudou um contrato entre serviços? Atualize `docs/contratos.md` no mesmo pull request.
- Precisa mudar a arquitetura? Anote em `docs/desvios-pendentes.md` e leve para a aula.

## Documentos

- [Contratos entre os serviços](docs/contratos.md)
- [Desvios pendentes de ADR](docs/desvios-pendentes.md)
- Requisitos implementados: `docs/requisitos-implementados.md` (a fazer)
- Princípios SOLID, onde e por quê: `docs/solid.md` (a fazer)

## Estado atual

Esqueleto: a infraestrutura sobe e cada serviço responde `GET /api/health`. As regras de negócio entram nas branches de cada papel.
