# Requisitos implementados (Trabalho III)

Sprint do Trabalho III sobre a arquitetura baseada em serviços do Grupo 4 (`docs/arquitetura/Documento_Arquitetural_T2_Grupo4.pdf`).

**Resultado:** 7 dos 16 requisitos funcionais do documento de requisitos (44%). Contamos 16 porque o documento tem dois REQ11: concluir a captura de tela e confirmar a captura por e-mail. O enunciado pede pelo menos 30%.

Escolhemos o fluxo completo de um registro de tela, do cadastro à consulta da evidência. Por isso entraram os 8 componentes que o Grupo 4 especificou como críticos: 07, 09, 10, 11, 12, 13, 14 e 20.

## Implementados

| Requisito | O que o sistema faz | Serviço | Componentes do Grupo 4 | Rota |
|---|---|---|---|---|
| REQ01 Cadastrar usuário | Cadastra advogado (OAB obrigatória) ou usuário comum, com os campos do Apêndice A; cria a carteira com `CREDITOS_INICIAIS` | contas-api, creditos-api | 01, 07 | `POST /api/contas` |
| REQ03 Logar no sistema | Devolve um JWT HS256 (`sub`, `jti`, `tipo`, `exp`) | contas-api | 02 | `POST /api/sessoes` |
| REQ04 Sair do sistema | Revoga o token; todos os serviços passam a recusá-lo (403) | contas-api e biblioteca `compartilhado` | 02 | `DELETE /api/sessoes/atual` |
| REQ08 Iniciar registro de conteúdo | Recebe URL e título, reserva 1 crédito, publica na fila e responde 202 (modo tela) | registro-api, creditos-api | 07, 09 | `POST /api/solicitacoes`, `GET /api/solicitacoes/:id` |
| REQ11 Concluir captura de tela | Captura a página (screenshot e HAR), sela a evidência (SHA-256, manifesto, carimbo RFC 3161, Object Lock) e conclui o registro efetivando o crédito | captura-worker, evidencia-api, relatorios-api, creditos-api | 10, 11, 12, 13, 14, 15, 20 | fila `captura`, rotas internas `/api/internal/*` |
| REQ12 Listar registros realizados | Lista os registros do usuário do token, mais novos primeiro | relatorios-api | 18 | `GET /api/registros` |
| REQ13 Visualizar detalhes do registro | URL, início, fim, arquivos, hashes e carimbo; registro de outro usuário responde 404 | relatorios-api | 18 | `GET /api/registros/:id` |

**Atributo de qualidade (Segurança):** só usuários cadastrados acessam. Toda rota, menos cadastro e login, exige o token, validado em cada serviço pela biblioteca `compartilhado`.

## Fora deste sprint

| Requisito | Motivo |
|---|---|
| REQ02 Recuperar senha | Depende de envio de e-mail (serviço Notificações, componente 08) |
| REQ05 Comprar créditos, REQ06 Efetuar pagamento | Dependem do gateway externo (Mercado Pago / Pix, componentes 03 a 06); o saldo inicial cobre a demonstração |
| REQ07, REQ10 e REQ11 (e-mail) | Serviço Notificações (componente 08); o Mailpit já está no `docker-compose.yml` |
| REQ09 Concluir gravação de conteúdo (vídeo) | Entra como um novo motor de captura (`IMotorCaptura`), sem mudar o caso de uso |
| REQ14 Gerar relatório, REQ15 Gerar zip | Componentes 16 e 17; dependem do registro pronto, que este sprint entrega |

## Como verificar

```bash
cp .env.example .env
docker compose up --build
```

Abra <http://localhost:8080>, crie uma conta, peça um registro e acompanhe até `CONCLUIDA`. Os testes automatizados rodam com `npm test` e no CI de cada pull request.
