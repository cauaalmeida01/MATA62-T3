# ADR-007 — Autenticação com JWT próprio e chaves em variáveis de ambiente

- **Status:** Aceita
- **Data:** 16/11/2026 (acordada com o Grupo 4 em 10/11/2026)
- **ADR do T2 afetada:** ADR-001 (Segurança, autenticação e controle de acesso)

## Contexto

A ADR-001 do Grupo 4 decidiu: autenticação obrigatória com sessões que expiram, emitidas pelo Amazon Cognito em JWT; verificação de propriedade em cada serviço; dados sensíveis cifrados com chaves do AWS KMS. Cognito e KMS só existem dentro de uma conta da AWS, que a ADR-006 decidiu não usar.

## Decisão

- A **contas-api** emite o token: JWT HS256 com `sub` (usuário), `jti` (id do token), `tipo` (`ADVOGADO` ou `COMUM`), `iat` e `exp`. A validade vem de `JWT_EXPIRA_EM` (1 hora no `.env.example`).
- A senha é guardada como hash **scrypt** com sal. O login responde a mesma mensagem para e-mail inexistente e senha errada.
- O CPF é cifrado com **AES-256-GCM** (`CPF_CHAVE_CIFRAGEM`). Um hash HMAC separado do CPF permite barrar CPF repetido sem decifrar.
- A validação do token fica na biblioteca `compartilhado` (`JwtAuthGuard`) e roda em **cada serviço**, como pede a ADR-001. Cada serviço continua conferindo se o recurso pertence ao usuário do token.
- **Logout** grava o `jti` em `compartilhado.tokens_revogados`; o guard recusa tokens revogados em todos os serviços.
- As chaves (`JWT_SECRET`, `CPF_CHAVE_CIFRAGEM`, `EVIDENCIA_INTERNAL_KEY`) ficam em variáveis de ambiente, nunca no código. O `.env.example` traz só valores de desenvolvimento.

## Alternativas consideradas

1. **Keycloak** (provedor de identidade aberto, parecido com o Cognito). Descartada: mais um contêiner pesado e uma configuração de realm e clientes que pesaria mais que o próprio serviço de Contas.
2. **Sessão no banco com token opaco.** Descartada: cada requisição de cada serviço teria de consultar a contas-api ou a tabela de sessões, acoplando todos os serviços a ela.
3. **JWT RS256 (par de chaves).** Melhor em segurança, porque os serviços só precisariam da chave pública. Adiada: exige gerar e distribuir chaves, e com HS256 a equipe entregou o fluxo completo no prazo. É a evolução natural (ver consequências).
4. **HashiCorp Vault no lugar do KMS.** Descartada: mais um serviço para operar, sem ganho para a demonstração.

## Justificativa

A decisão da ADR-001 é preservada: login obrigatório, sessão que expira, checagem de acesso repetida em cada serviço e CPF cifrado. Muda só quem emite o token e onde ficam as chaves. Por ficar atrás das portas (`IEmissorToken`, `IProtetorCpf`, `IHasherSenha`), trocar para Cognito ou KMS depois é escrever um adaptador novo.

## Consequências

**Positivas**
- Nenhuma dependência externa para autenticar.
- O logout vale na hora em todos os serviços.
- Testes da contas-api rodam sem rede e sem banco.

**Negativas**
- Com HS256, todo serviço que valida o token tem o segredo que também assina tokens. Um serviço comprometido poderia emitir tokens; em produção, usar RS256 ou o Cognito.
- Sem rotação nem auditoria de uso das chaves, que o KMS faria.
- Sem MFA e sem recuperação de senha (REQ02 ficou fora deste sprint).
- Sem TLS no ambiente local (ver ADR-006).

## Requisitos e restrições relacionados

- Segurança: o único atributo de qualidade explícito nos requisitos e parte do Top 4.
- REQ01 (cadastro com CPF e OAB), REQ03 (login), REQ04 (logout).
- LGPD: proteção do CPF.

## Acordo com o Grupo 4

Acordado em sala em 10/11/2026 (Issue #1: Cognito → JWT próprio; KMS → chave em variável de ambiente).
