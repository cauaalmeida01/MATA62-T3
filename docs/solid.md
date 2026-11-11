# Princípios SOLID: onde e por quê

> Cada papel escreve os exemplos do próprio serviço. A organização final do arquivo é do papel E.

## Registros e Relatórios + Web (papel D)

Camadas da relatorios-api, de dentro para fora:

```
dominio/     Registro (entidade), portas (interfaces), erros de domínio   ← não conhece Nest, Prisma nem HTTP
aplicacao/   ConcluirRegistro, ListarRegistros, DetalharRegistro           ← só depende do domínio
infra/       RegistroRepositorioPrisma, CreditosClientHttp, PrismaService  ← implementa as portas
entrada/     controllers, DTOs, guard de autenticação                     ← traduz HTTP <-> casos de uso
app.module   raiz de composição: liga cada porta à sua implementação
```

### D — Inversão de dependência

**Onde:** `aplicacao/concluir-registro.ts` depende das interfaces `RegistroRepositorio` e `CreditosClient` (`dominio/portas.ts`). As implementações concretas (`infra/registro-repositorio.prisma.ts` e `infra/creditos-client.http.ts`) só aparecem em `app.module.ts`.

**Por quê:** a regra "efetivar o crédito e depois gravar o registro" é de negócio e não deve mudar se trocarmos o Prisma por outro ORM, ou o HTTP por uma fila. É também o ponto que corrige o zip, onde um domínio chamava a classe concreta de outro. Aqui a relatorios-api fala com Créditos só pela interface `CreditosClient`. Nos testes, `CreditosClientFalso` e `RegistroRepositorioEmMemoria` entram no lugar das implementações reais, sem banco nem rede.

**No front:** as telas dependem da interface `VeriditApi` (`web/src/api/tipos.ts`). `sessao.tsx` escolhe entre `criarApiHttp` e `criarApiFalsa` (modo mock) num lugar só.

### S — Responsabilidade única

**Onde:** cada camada tem um motivo para mudar.
- `Registro` muda se as regras do registro mudarem (ex.: aceitar outra fonte de carimbo).
- `ConcluirRegistro` muda se o fluxo de conclusão mudar.
- `RegistroRepositorioPrisma` muda se o banco mudar.
- `RegistrosController` muda se o contrato HTTP mudar. Ele não tem regra de negócio; os erros de domínio viram HTTP no filtro comum.

**Por quê:** no zip, a regra de negócio lançava `HttpException` e usava o Prisma direto. Agora a entidade lança `RegraDeNegocioViolada` e não sabe que existe HTTP.

### I — Segregação de interfaces

**Onde:** `CreditosClient` tem só `efetivar`, embora a creditos-api também ofereça reservar e liberar. A relatorios-api não usa as outras operações, então não depende delas. O mesmo vale para `RegistroRepositorio`: só as quatro operações que os casos de uso chamam.

**Por quê:** se a rota de liberar mudar, a relatorios-api não é afetada.

### L — Substituição de Liskov

**Onde:** `RegistroRepositorioEmMemoria` e `RegistroRepositorioPrisma` cumprem o mesmo contrato, inclusive a regra de que `salvar` devolve o registro existente quando duas conclusões da mesma solicitação chegam juntas. Os casos de uso funcionam com qualquer uma das duas.

**Por quê:** é o que permite testar os casos de uso com o dublê e confiar que valem para o Prisma.

### O — Aberto/fechado

**Onde:** para trocar uma tecnologia, cria-se uma nova implementação da porta e muda-se uma linha em `app.module.ts`, sem editar os casos de uso. Exemplo: quando a biblioteca de autenticação do papel E existir, o guard provisório é substituído sem tocar nos controllers além do decorator.
