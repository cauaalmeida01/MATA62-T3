# ADR-008 — FreeTSA como autoridade de carimbo do tempo

- **Status:** Aceita
- **Data:** 16/11/2026 (acordada com o Grupo 4 em 10/11/2026)
- **ADR do T2 afetada:** ADR-003 (Auditabilidade e integridade na origem das evidências)

## Contexto

A ADR-003 do Grupo 4 decidiu que cada evidência recebe um carimbo do tempo RFC 3161 emitido por uma Autoridade de Carimbo do Tempo credenciada na ICP-Brasil. O próprio Grupo 4 registrou o trade-off: cada carimbo tem custo e exige contrato com uma ACT externa. Nenhum dos dois é viável num trabalho acadêmico.

## Decisão

- Usar a **FreeTSA** (`TSA_URL=https://freetsa.org/tsr`), uma autoridade gratuita que segue o mesmo protocolo RFC 3161.
- O que se carimba é o SHA-256 do **manifesto** (`manifesto.json`), que reúne URL, horários e o SHA-256 de cada arquivo capturado. Um carimbo cobre todos os arquivos.
- O carimbo fica atrás da porta `ICarimbadorTempo`; o adaptador é o `Rfc3161Carimbador` da evidencia-api.
- Se a FreeTSA não responder, o carimbo é feito com o relógio do servidor e marcado como `RELOGIO_LOCAL`. A fonte (`FREETSA` ou `RELOGIO_LOCAL`) vai no pacote selado, fica gravada e aparece no detalhe do registro.

## Alternativas consideradas

1. **ACT credenciada na ICP-Brasil**, como na ADR-003. Descartada para o T3 por custo e contrato; continua sendo a escolha para produção.
2. **Só o relógio do servidor.** Descartada como padrão: não prova nada a terceiros. Ficou apenas como contingência explícita.
3. **Registro em blockchain.** Já descartada pelo Grupo 4 na ADR-003 (nenhum requisito pede e tem menos respaldo jurídico).
4. **Falhar a captura quando a TSA não responde.** Descartada: o conteúdo pode sumir da internet a qualquer momento (contexto da ADR-002). É melhor guardar a captura com o carimbo marcado como local do que perdê-la.

## Justificativa

Como a FreeTSA fala o mesmo RFC 3161 de uma ACT ICP-Brasil, trocar de autoridade é mudar a URL e, se a ACT exigir, as credenciais. O caso de uso de selagem não muda. Assim a implementação exercita o mecanismo inteiro da ADR-003 (hash, manifesto, carimbo, armazenamento imutável e trilha) sem o custo.

## Consequências

**Positivas**
- Carimbo real, verificável com ferramentas padrão (por exemplo `openssl ts -verify`).
- A troca para uma ACT ICP-Brasil é configuração.
- Quando a FreeTSA cai, a captura não se perde e o registro mostra que o carimbo é local.

**Negativas**
- O carimbo da FreeTSA não tem a presunção de validade jurídica de um carimbo ICP-Brasil.
- A FreeTSA é gratuita e não garante disponibilidade. Registros com `RELOGIO_LOCAL` não têm valor de prova de data.
- O serviço ainda não valida a assinatura do token devolvido pela FreeTSA. Ele confere que o carimbo corresponde ao hash do manifesto, mas não a cadeia de certificados da autoridade.

## Requisitos e restrições relacionados

- Top 4: Auditabilidade.
- REQ11 (concluir captura de tela: a selagem faz parte da conclusão) e REQ13 (o detalhe mostra o carimbo e a fonte).

## Acordo com o Grupo 4

Acordado em sala em 10/11/2026 (Issue #1: ACT ICP-Brasil → FreeTSA, ambas RFC 3161).
