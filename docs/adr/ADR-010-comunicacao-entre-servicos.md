# ADR-010 — HTTP interno entre serviços e fila só para a captura

- **Status:** Aceita
- **Data:** 16/11/2026 (acordada com o Grupo 4 em 10/11/2026)
- **ADR do T2 relacionada:** complementa a ADR-005 (estilo baseado em serviços); não substitui nenhuma

## Contexto

A ADR-005 do Grupo 4 define seis serviços, um banco PostgreSQL compartilhado e uma fila dedicada à captura, e alerta que o banco compartilhado exige "disciplina de governança sobre o esquema". O documento não diz como os serviços conversam fora da fila. Vários fluxos atravessam serviços:

- o cadastro cria a carteira;
- o pedido de registro reserva um crédito;
- o worker sela a evidência e conclui o registro;
- a conclusão efetiva o crédito;
- a DLQ e a reconciliação liberam o crédito.

Com o banco compartilhado, seria possível um serviço ler ou alterar direto as tabelas de outro.

## Decisão

1. **Cada serviço é dono do seu esquema** (`contas`, `creditos`, `registro`, `evidencia`, `relatorios`). Nenhum lê ou escreve no esquema de outro. A exceção é o esquema `compartilhado`, usado pela biblioteca comum (`tokens_revogados` e `trilha_auditoria`).
2. **Precisou de outro serviço, chama a rota interna dele por HTTP** (`/api/internal/*`). Essas rotas só existem na rede do Docker; o Nginx responde 404 para elas.

   | Quem chama | Serviço chamado | Para quê |
   |---|---|---|
   | contas-api | creditos-api | Criar a carteira no cadastro |
   | registro-api | creditos-api | Reservar 1 crédito antes de aceitar o pedido |
   | captura-worker | evidencia-api | Selar a evidência (exige o cabeçalho `x-internal-api-key`) |
   | captura-worker | relatorios-api | Concluir o registro |
   | relatorios-api | creditos-api | Efetivar a reserva |
   | captura-worker (DLQ e reconciliação) | creditos-api | Liberar a reserva |

3. **Toda chamada interna é idempotente** (por `solicitacaoId` ou `reservaId`), porque a fila entrega uma mensagem pelo menos uma vez e o worker pode repetir chamadas.
4. **A fila continua só para a captura** (ADR-002). É a única operação lenta e sujeita a falhas externas.
5. Os contratos (rotas, corpos, códigos de erro, mensagem da fila e pacote selado) ficam em `docs/contratos.md`, e quem muda um contrato atualiza esse arquivo no mesmo pull request.

## Alternativas consideradas

1. **Acesso direto ao esquema de outro serviço.** Descartada: mais rápido de escrever, mas acopla os esquemas, e uma mudança de tabela quebra outro serviço sem aviso. É o risco que a ADR-005 pediu para governar.
2. **Eventos na fila para tudo** (estilo orientado a eventos). Descartada: a reserva precisa de resposta antes do `202`. Se fosse assíncrona, o usuário sem saldo só descobriria depois, e o sistema teria de desfazer pedidos já aceitos.
3. **gRPC entre serviços.** Descartada: contratos tipados, mas sem ganho para o volume do Veridit e com mais ferramentas para a equipe aprender.

## Justificativa

A reserva tem de ser síncrona: o pedido só é aceito se o crédito foi separado, e sem saldo a resposta é `402` na hora. As demais chamadas internas acontecem no worker, fora da requisição do usuário; se falharem, a mensagem volta para a fila e a chamada se repete, por isso precisam ser idempotentes. Rotas internas com contratos escritos mantêm as fronteiras entre serviços que dão sentido ao estilo baseado em serviços.

## Consequências

**Positivas**
- Fronteiras claras: cada serviço pode mudar suas tabelas sem afetar os outros.
- Casos de uso testados com clientes HTTP falsos (por exemplo `ICreditosClient`).
- Repetir uma chamada nunca duplica crédito, evidência ou registro.

**Negativas**
- Acoplamento temporal: se a creditos-api estiver fora do ar, novos pedidos de registro falham. Capturas já na fila esperam e são retentadas.
- Só a rota da evidência exige chave interna. As outras confiam no isolamento da rede do Docker; em produção, todas deveriam autenticar o serviço que chama.
- Mais chamadas de rede que um acesso direto ao banco.

## Requisitos e restrições relacionados

- Top 4: Confiabilidade (reserva, efetivação e liberação de créditos, ADR-004) e Disponibilidade (fila só para a captura, ADR-002).
- REQ01 (carteira no cadastro), REQ08 (reserva no pedido), REQ11 (selagem, conclusão e efetivação).

## Acordo com o Grupo 4

Acordado em sala em 10/11/2026 (Issue #1: "HTTP entre serviços para a reserva; fila para a captura").
