# ADRs do Trabalho III

As ADR-001 a ADR-005 são do Grupo 4 e estão no [documento arquitetural do T2](../arquitetura/Documento_Arquitetural_T2_Grupo4.pdf) (resumidas em [`ADR's.md`](../../ADR's.md), na raiz). Elas continuam valendo. As ADRs desta pasta registram os desvios que a implementação do T3 precisou fazer.

## Situação

- **10/11/2026, em sala:** os desvios foram acordados com a equipe autora da arquitetura (Daniel Santana, Davi Guimarães, Gabriel Barreto e Leone Vicentine). Registro do acordo: Issue #1.
- **16/11/2026:** ADRs escritas e commitadas. A sessão supervisionada de 12/11 não aconteceu, e o professor autorizou registrar as ADRs fora da sala.
- **Uso de IA:** as ADRs foram redigidas com apoio de IA (Claude) a partir do que a equipe decidiu e implementou. A equipe revisou o texto e assume as decisões.

## Índice

| ADR | Título | Status | ADR do T2 afetada |
|---|---|---|---|
| [ADR-006](ADR-006-infraestrutura-local.md) | Infraestrutura local equivalente aos serviços da AWS | Aceita | ADR-002, ADR-003, ADR-005 |
| [ADR-007](ADR-007-autenticacao-propria.md) | Autenticação com JWT próprio e chaves em variáveis de ambiente | Aceita | ADR-001 |
| [ADR-008](ADR-008-carimbo-freetsa.md) | FreeTSA como autoridade de carimbo do tempo | Aceita | ADR-003 |
| [ADR-009](ADR-009-isolamento-da-captura.md) | Contexto de navegador novo por captura | Aceita | ADR-001 |
| [ADR-010](ADR-010-comunicacao-entre-servicos.md) | HTTP interno entre serviços e fila só para a captura | Aceita | complementa a ADR-005 |

Os desvios trocam serviços gerenciados da AWS por equivalentes locais e definem o que o T2 não definiu. Não mudam o estilo baseado em serviços, os seis serviços nem as Top 4 características.

## Modelo

Cada ADR tem: status, data, contexto, decisão, alternativas consideradas, justificativa, consequências, requisitos e restrições relacionados, ADR do T2 afetada e registro do acordo com o Grupo 4.

Para mudar uma decisão, crie uma ADR nova que substitua a anterior e altere o status da antiga para "Substituída pela ADR-0XX". Não reescreva o histórico.
