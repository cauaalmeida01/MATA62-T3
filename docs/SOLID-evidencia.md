# Princípios SOLID — Serviço Evidência (Papel C)

Este trecho pode ser incorporado a `docs/SOLID.md` depois da revisão do grupo.

- **SRP:** o `EvidenciasController` trata apenas da interface HTTP, `SelarEvidenciaUseCase` coordena a selagem, `S3ArmazenamentoAdapter` somente armazena, `Rfc3161Carimbador` obtém o carimbo e `PostgresEvidenciaRepository` isola a persistência.
- **OCP:** adicionar uma TSA alternativa, cliente S3 SDK ou implementação de banco exige novo adaptador compatível com as portas de domínio, sem modificar o caso de uso.
- **LSP:** os adaptadores reais são substituídos por mocks tipados em testes do caso de uso (`IEvidenciaRepository`, `IArmazenamentoEvidencia`, `ICarimbadorTempo`) preservando os contratos.
- **ISP:** cada porta disponibiliza só o método necessário: `carimbar`, `gravar`, `buscarPorSolicitacao` e `salvar`, sem uma interface de infraestrutura monolítica.
- **DIP:** o caso de uso depende de interfaces e tokens `Symbol` do domínio; o `AppModule` do NestJS liga as portas aos adaptadores usando `provide`/`useClass`.
