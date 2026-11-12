# Princípios SOLID no Veridit (Trabalho III — MATA62)

Este documento descreve onde e por que os princípios **SOLID** foram aplicados na implementação dos serviços do **Veridit**, relacionando as decisões de código com a arquitetura baseada em serviços e o padrão de **Portas e Adaptadores (Arquitetura Hexagonal)**.

---

## Serviço de Registro e Captura — Papel B (`registro-api` e `captura-worker`)

Nos serviços `registro-api` (`apps/registro-api`) e `captura-worker` (`apps/captura-worker`), a arquitetura foi dividida estritamente nas camadas de **Domínio** (`dominio/`), **Aplicação** (`aplicacao/`), **Infraestrutura** (`infra/`) e **Apresentação** (`apresentacao/`). Abaixo estão os exemplos concretos de aplicação de cada princípio SOLID.

### 1. Single Responsibility Principle (SRP — Princípio da Responsabilidade Única)

Cada classe da `registro-api` e do `captura-worker` possui uma única razão para mudar, evitando classes "Deus" que misturam validação de segurança, regras de negócio, chamadas HTTP, acesso ao banco PostgreSQL e manipulação de filas SQS no mesmo lugar:

- **Validação de Segurança Anti-SSRF (`DnsValidadorUrlSegura` e `DnsValidadorUrlSeguraWorker`):** Responsáveis exclusivamente por validar o formato e o protocolo da URL (`http:`/`https:`), bloquear hosts internos da rede Docker e resolver o DNS (`dns.lookup`) para impedir acessos a faixas de IP privadas, loopback ou link-local (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`, `fe80::/10`). Se a política de rede mudar, apenas o validador é alterado.
- **Entidade e Regras de Estado (`SolicitacaoRegistro`):** Concentra apenas as invariantes de negócio da solicitação e as regras de transição de estado (`PENDENTE` → `PROCESSANDO` → `CONCLUIDA` ou `FALHOU`), sem conhecer HTTP ou SQL.
- **Orquestração de Casos de Uso (`CriarSolicitacaoUseCase`, `ConsultarSolicitacaoUseCase`, `ProcessarCapturaUseCase`, `ProcessarDlqUseCase` e `ReconciliarSolicitacoesTravadasUseCase`):** Cada caso de uso coordena um único fluxo funcional do negócio. Por exemplo, o `ProcessarCapturaUseCase` apenas coordena a sequência da captura, selagem e conclusão, delegando o consumo de mensagens da fila ao `SqsCapturaConsumer`, o tratamento de falhas definitivas ao `ProcessarDlqUseCase` (acionado pelo `SqsDlqConsumer`) e a limpeza periódica de solicitações expiradas ao `ReconciliarSolicitacoesTravadasUseCase` (acionado pelo `ReconciliacaoScheduler`).
- **Acesso a Dados e Filas (`PostgresSolicitacaoRepository`, `PostgresSolicitacaoWorkerRepository`, `SqsFilaCapturaPublisher`):** Isolam toda a comunicação SQL com o schema `registro.solicitacoes` e os comandos do AWS SDK para o ElasticMQ.

---

### 2. Open-Closed Principle (OCP — Princípio Aberto-Fechado) e Liskov Substitution Principle (LSP — Princípio da Substituição de Liskov)

O principal ponto de variação técnica do `captura-worker` é o mecanismo utilizado para capturar o conteúdo da página web e gerar os artefatos probatórios (`screenshot.png` e `rede.har`). Para atender ao **OCP** e ao **LSP**, definimos na camada de domínio a porta **`IMotorCaptura`** (`apps/captura-worker/src/dominio/portas/motor-captura.port.ts`), cujo contrato exige apenas o método `capturar(opcoes: OpcoesCaptura): Promise<ResultadoCaptura>`.

Na camada de infraestrutura, fornecemos duas implementações concretas e intercambiáveis dessa interface:
1. **`PlaywrightMotorCaptura` (`apps/captura-worker/src/infra/playwright-motor-captura.ts`):** Utiliza um navegador Chromium headless real, criando um `BrowserContext` limpo e isolado por sessão, interceptando sub-requisições contra SSRF, gravando o tráfego de rede em arquivo `.har` e capturando a imagem `.png` da página renderizada.
2. **`HttpSimplesMotorCaptura` (`apps/captura-worker/src/infra/http-simples-motor-captura.ts`):** Implementação leve baseada em `fetch` nativo que realiza a requisição HTTP real e constrói o pacote de artefatos (`pagina.html` com `mimeType: 'text/html'` + `rede.har` estruturado) para cenários de captura HTML ou ambientes sem navegador completo.

O caso de uso `ProcessarCapturaUseCase` está **fechado para modificação** (não conhece Playwright nem `fetch` e não precisa ser editado quando a tecnologia de captura muda) e **aberto para extensão** (novos motores, como captura de vídeo ou PDF, podem ser adicionados criando uma nova classe que implemente `IMotorCaptura`). Além disso, em conformidade com o **LSP**, qualquer implementação de `IMotorCaptura` pode substituir a outra (selecionada dinamicamente no `WorkerModule` via variável de ambiente `MOTOR_CAPTURA=playwright|http` ou por um mock nos testes unitários) mantendo todas as pós-condições do contrato (`ResultadoCaptura` com timestamps, metadados e buffers dos arquivos) sem quebrar o funcionamento do sistema.

---

### 3. Interface Segregation Principle (ISP — Princípio da Segregação de Interface)

Em vez de criar uma única interface genérica de comunicação entre microsserviços (como um `IServicosInternosHttpClient` monolítico) ou expor clientes HTTP brutos para a camada de aplicação, segregamos as portas do domínio em interfaces pequenas, coesas e específicas para o papel de cada consumidor:

- Na `registro-api`, a porta **`ICreditosClient`** (`apps/registro-api/src/dominio/portas/creditos-client.port.ts`) declara apenas `reservarCredito()` e `liberarReserva()`. Já no `captura-worker`, a porta **`ICreditosClient`** (`apps/captura-worker/src/dominio/portas/creditos-client.port.ts`) é ainda mais enxuta e expõe **exclusivamente** `liberarReserva(reservaId, motivo?)`, pois o worker nunca realiza novas reservas de crédito (apenas libera reservas na DLQ ou no Job de Reconciliação).
- Da mesma forma, **`IEvidenciaClient`** expõe unicamente `selarEvidencia()`, **`IRelatoriosClient`** expõe apenas `concluirRegistro()`, e **`IFilaCapturaPublisher`** expõe apenas `publicarSolicitacao()`. Assim, nenhum caso de uso depende de métodos que não utiliza.

---

### 4. Dependency Inversion Principle (DIP — Princípio da Inversão de Dependência)

Em ambos os serviços (`registro-api` e `captura-worker`), os módulos de alto nível (casos de uso na pasta `aplicacao/`) **nunca importam** módulos de baixo nível (adaptadores na pasta `infra/` ou bibliotecas externas como `pg`, `@aws-sdk/client-sqs` e `playwright`). Tanto os casos de uso quanto os adaptadores de infraestrutura dependem exclusivamente de **abstrações** (interfaces e tokens `Symbol` definidos em `dominio/portas/`):

- O **`CriarSolicitacaoUseCase`** recebe no construtor as abstrações injetadas pelos tokens `VALIDADOR_URL_SEGURA` (`IValidadorUrlSegura`), `CREDITOS_CLIENT` (`ICreditosClient`), `SOLICITACAO_REPOSITORY` (`ISolicitacaoRepository`) e `FILA_CAPTURA_PUBLISHER` (`IFilaCapturaPublisher`).
- O **`ProcessarCapturaUseCase`** recebe no construtor as abstrações `SOLICITACAO_WORKER_REPOSITORY` (`ISolicitacaoWorkerRepository`), `VALIDADOR_URL_SEGURA_WORKER` (`IValidadorUrlSegura`), `MOTOR_CAPTURA` (`IMotorCaptura`), `EVIDENCIA_CLIENT` (`IEvidenciaClient`) e `RELATORIOS_CLIENT` (`IRelatoriosClient`).

A ligação entre cada porta do domínio e seu adaptador concreto de infraestrutura é feita exclusivamente na borda da aplicação — nos módulos de composição do NestJS (`AppModule` em `apps/registro-api/src/app.module.ts` e `WorkerModule` em `apps/captura-worker/src/worker.module.ts`) por meio de `provide` / `useClass` e `useFactory`. Graças a essa inversão de dependência, toda a lógica de negócio da `registro-api` e do `captura-worker` pôde ser testada unitariamente em memória (`registro-api.spec.ts` e `captura-worker.spec.ts`) sem necessidade de subir banco PostgreSQL, ElasticMQ ou Chromium.

---

## Serviços de Contas e de Créditos — Papel A (`contas-api` e `creditos-api`)

Os dois serviços seguem as mesmas camadas do Papel B (`dominio/`, `aplicacao/`, `apresentacao/`, `infra/`). Os exemplos abaixo são os que usamos para explicar cada princípio.

### 1. SRP (Responsabilidade Única)

- **Regras de saldo em `Carteira`** (`apps/creditos-api/src/dominio/carteira.entity.ts`) e **regras de status em `Reserva`** (`reserva.entity.ts`). A carteira só sabe mexer em `disponivel` e `reservado`; a reserva só sabe ir de `RESERVADA` para `EFETIVADA` ou `LIBERADA`, uma única vez. Nenhuma das duas conhece HTTP ou SQL.
- **Proteção de dados separada por motivo de mudança** na `contas-api`: `ScryptHasherSenha` cuida só da senha, `AesProtetorCpf` só do CPF e `JwtEmissorToken` só do token. Trocar o algoritmo de hash da senha, por exemplo, não toca no cadastro nem no login.
- **Controllers só traduzem HTTP** (`ContasController`, `CreditosController`, `CreditosInternosController`): recebem o DTO, chamam o caso de uso e devolvem a resposta. Os erros de domínio viram HTTP no `FiltroErrosDominio`.

### 2. OCP (Aberto-Fechado)

- **`EncerrarReservaUseCase`** (`apps/creditos-api/src/aplicacao/encerrar-reserva.use-case.ts`) guarda o roteiro comum de encerrar uma reserva: abrir a transação, travar a reserva, travar a carteira, gravar. `EfetivarReservaUseCase` e `LiberarReservaUseCase` só dizem o que fazer na reserva e na carteira. Uma nova forma de encerrar (um estorno, por exemplo) seria uma nova subclasse, sem editar o roteiro.
- **`JwtAuthGuard`** (`libs/compartilhado/src/autorizacao`) é fechado para modificação: depende da porta `ITokensRevogados`. Se a lista de revogados sair do PostgreSQL para o Redis, cria-se outro adaptador, e o guard continua igual.

### 3. LSP (Substituição de Liskov)

- Os testes trocam os adaptadores de banco por versões em memória (`UnidadeDeTrabalhoEmMemoria`, `UsuariosEmMemoria`, `RevogadosEmMemoria`) e os casos de uso funcionam igual. A versão em memória da unidade de trabalho respeita o mesmo contrato da real, inclusive o "tudo ou nada": se o trabalho lança erro, nada é gravado.

### 4. ISP (Segregação de Interface)

- A `contas-api` só precisa criar carteiras, então sua porta **`ICreditosClient`** (`apps/contas-api/src/dominio/portas/creditos-client.port.ts`) tem só `criarCarteira()`. A `registro-api` tem a sua com `reservarCredito()` e `liberarReserva()`, e o `captura-worker` só com `liberarReserva()`. Cada consumidor enxerga só o que usa da `creditos-api`.
- **`IHasherSenha`**, **`IProtetorCpf`** e **`IEmissorToken`** são portas pequenas, em vez de uma única "interface de segurança".

### 5. DIP (Inversão de Dependência)

- **`ReservarCreditoUseCase`** depende de **`IUnidadeDeTrabalhoCreditos`**, uma interface do domínio, e não do PostgreSQL. O adaptador `PostgresUnidadeDeTrabalhoCreditos` (em `infra/`) é quem abre `BEGIN ... COMMIT` e faz o `SELECT ... FOR UPDATE`. A ligação entre os dois só acontece no `AppModule`.
- **`CadastrarUsuarioUseCase`** recebe as portas `IUsuarioRepository`, `IHasherSenha`, `IProtetorCpf` e `ICreditosClient`. Ele não sabe que a creditos-api é chamada por HTTP; por isso o teste roda com um cliente falso e consegue simular a creditos-api fora do ar.
- Graças a isso, as regras de negócio dos dois serviços são testadas sem banco (`contas-api.spec.ts`, `creditos-api.spec.ts`). Só o teste de concorrência (`creditos-concorrencia.spec.ts`) usa PostgreSQL de verdade, porque é o banco que garante a trava.
