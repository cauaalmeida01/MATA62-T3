# ADR-009 — Contexto de navegador novo por captura

- **Status:** Aceita
- **Data:** 16/11/2026 (acordada com o Grupo 4 em 10/11/2026)
- **ADR do T2 afetada:** ADR-001 (Segurança), tática "Limitar exposição (isolamento)" do documento do T2

## Contexto

A ADR-001 e a tática "Limitar exposição" do Grupo 4 decidiram executar cada captura num contêiner Fargate efêmero e isolado, destruído ao final. O objetivo é que uma página maliciosa não contamine outras capturas nem o resto do sistema.

Sem o Fargate (ADR-006), criar um contêiner por captura exigiria dar ao worker acesso ao Docker do computador (`/var/run/docker.sock`). Quem controla esse socket controla a máquina inteira, então o próprio isolamento viraria a maior falha de segurança do sistema.

## Decisão

- A captura roda no **captura-worker**, um contêiner separado das APIs, com a fila como única entrada.
- Cada worker mantém um processo do Chromium (Playwright) e abre um **contexto de navegador novo para cada captura**, com cookies, armazenamento e cache vazios. O contexto é fechado no fim da captura, com sucesso ou erro.
- A URL é validada contra SSRF antes de entrar na fila, e o worker intercepta **cada sub-requisição** da página para bloquear endereços internos (redes privadas, localhost, metadados de nuvem).
- Se o navegador travar ou o processo cair, a mensagem não é confirmada e volta para a fila (ADR-002); depois de 3 tentativas vai para a DLQ e a reserva é liberada (ADR-004).

## Alternativas consideradas

1. **Contêiner por captura via socket do Docker.** Descartada: o worker passaria a ter poder de administrador sobre a máquina.
2. **Processo do Chromium novo por captura.** Isola mais que um contexto, ao custo de 1 a 2 segundos por captura. Pode virar uma opção de configuração sem mudar o caso de uso, porque o motor fica atrás da porta `IMotorCaptura`.
3. **Sandbox de kernel (gVisor, Firecracker).** Descartada: fora do escopo e indisponível no Docker Desktop padrão.

## Justificativa

O contexto novo garante o que importa para a prova: nenhuma captura herda estado de outra (sessão, cookies, cache), e uma falha do navegador derruba só o worker, não as APIs. Junto com o bloqueio de SSRF, isso cobre os riscos práticos de abrir URLs arbitrárias no ambiente local, sem abrir a máquina para o worker.

## Consequências

**Positivas**
- Capturas independentes entre si e entre usuários.
- Falhas do navegador ficam contidas no worker e são reprocessadas pela fila.
- Mais capacidade de captura com `--scale captura-worker=N`.

**Negativas**
- Isolamento mais fraco que o contêiner efêmero da ADR-001. Uma falha explorável no Chromium alcançaria o processo do worker e as capturas seguintes daquele contêiner.
- O Chromium roda com `--no-sandbox`, porque o contêiner executa como root. Rodar o worker com um usuário sem privilégios e reativar o sandbox é a primeira melhoria a fazer.
- Em produção, a decisão original (contêiner efêmero por captura no Fargate) volta a valer.

## Requisitos e restrições relacionados

- Top 4: Segurança e Disponibilidade.
- REQ08 e REQ11 (captura de tela).

## Acordo com o Grupo 4

Acordado em sala em 10/11/2026 (Issue #1: contêiner efêmero por captura → navegador novo por sessão no worker).
