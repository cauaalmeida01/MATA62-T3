# Divergências entre o protótipo de telas e a implementação (papel D)

O front segue o protótipo de telas do Veridit (cores, tipografia, componentes e disposição). Quando o protótipo mostra algo que os requisitos da sprint ou os contratos entre serviços (`docs/contratos.md`) não sustentam, **a tela foi ajustada ao código**, e não o contrário. Cada ajuste está listado abaixo, com o motivo.

## Telas implementadas

| Tela do protótipo | Requisito | Situação |
|---|---|---|
| Entrar | REQ03 | Implementada, com ajustes |
| Criar conta | REQ01 | Implementada, com ajustes |
| Meus registros | REQ12 (e REQ04, Sair, no cabeçalho) | Implementada, com ajustes |
| Novo registro | REQ08 | Implementada, com ajustes |
| Selando sua evidência | REQ11 | Implementada, com ajustes |
| Detalhes do registro | REQ13 | Implementada, com ajustes |

## Telas fora da sprint (não implementadas)

| Tela do protótipo | Requisito | Motivo |
|---|---|---|
| Recuperar senha e Criar nova senha | REQ02 | Fora da sprint; só entra se sobrar tempo (plano, seção 3) |
| Comprar créditos, Faturamento, Pagamento e Pagamento confirmado | REQ05, REQ06, REQ07 | Fora da sprint; substituídos pelos créditos iniciais de teste |
| Sessão de navegação interativa | REQ09 | O grupo usa captura automática pelo `captura-worker` (plano, seção 1) |
| Relatório em PDF | REQ14 | Fora da sprint |

## Ajustes nas telas implementadas

### Comuns a todas

- **Etiquetas de requisito** (as caixas tracejadas "REQ03 · Segurança"): são anotações do protótipo, não fazem parte do produto.
- **Cabeçalho:** mostra só o saldo de créditos e Sair. O protótipo mostra nome, tipo e OAB do usuário, mas nenhuma rota do contrato devolve esses dados, e criar uma rota só para isso mudaria a contas-api (papel A) sem requisito que peça.
- **Menu:** só "Meus registros" e "Novo registro". "Comprar créditos" está fora da sprint.
- **Painel azul das telas de entrada:** os três destaques foram reescritos para o que a sprint entrega. Saíram "assinatura" e "relatório e pacote .zip", porque o sistema não tem assinatura digital nem gera o pacote.

### Entrar (REQ03)

- Sem o link "Esqueci minha senha": REQ02 está fora da sprint.

### Criar conta (REQ01)

- Sem a opção "Empresa · em breve": não existe no requisito nem no contrato.
- O aceite dos Termos e da LGPD é validado só na tela. O contrato do cadastro não tem esse campo.
- Senha com mínimo de 10 caracteres, como no protótipo. **A contas-api (papel A) precisa validar o mesmo mínimo.**

### Meus registros (REQ12)

- **Lista só registros concluídos.** O REQ12 e a rota `GET /api/registros` são da relatorios-api, que só conhece registros concluídos. Registros "Selando" e "Falhou" vivem na registro-api, que não tem rota de listagem no contrato. Por isso:
  - a coluna Status mostra sempre "Concluído";
  - saiu o filtro de status;
  - o card "Em andamento" virou **"Créditos reservados"**, que vem de `GET /api/creditos/saldo` e equivale ao número de registros ainda em processamento.
- O acompanhamento de um registro em andamento aparece na tela "Selando sua evidência", logo depois de iniciá-lo.
- Busca por título, filtro de período e paginação são feitos no navegador, sobre a lista devolvida pela API.

### Novo registro (REQ08)

- Só a opção "Captura de tela". "Vídeo de navegação" está fora da sprint (o contrato só aceita `modo: "TELA"`).
- O texto "Como a captura funciona" deixou de citar assinatura digital.
- "Iniciar registro" leva direto ao acompanhamento, sem a sessão de navegação interativa.

### Selando sua evidência (REQ11)

- O protótipo tem cinco etapas (captura, hashes, manifesto assinado, carimbo, relatório/zip). O contrato só informa quatro status da solicitação (`PENDENTE`, `PROCESSANDO`, `CONCLUIDA`, `FALHOU`), então a tela mostra três etapas: pedido recebido, captura e selagem, e registro concluído. Mostrar as cinco exigiria que a registro-api soubesse em qual passo a evidencia-api está, o que o contrato não prevê.
- Sem o card "Avisaremos por e-mail": o e-mail de conclusão (REQ11b) é extra e só entra se sobrar tempo.
- Inclui o estado de falha, que o protótipo não mostra: após três tentativas sem sucesso, a mensagem explica que o crédito voltou ao saldo.

### Detalhes do registro (REQ13)

- Sem os botões "Baixar relatório (PDF)" e "Baixar pacote .zip": REQ14 e REQ15 estão fora da sprint.
- Sem "Usuário responsável", "IP do servidor de destino" e "certificado TLS": esses dados não existem no pacote selado do contrato.
- Sem "Assinatura digital": o plano não implementa assinatura, só hash e carimbo do tempo.
- **Carimbo do tempo:** o protótipo cita "ACT ICP-Brasil". A implementação usa a FreeTSA, ou o relógio local quando ela não responde (ADR-008, a criar em sala). A tela mostra qual foi usada, como pede o contrato. Quando é o relógio local, o quadro final fica amarelo e explica que a hora não tem atestado de terceiro.
- O ID do registro é o UUID gerado pelo banco, e não um código como "REG-8F3A21-7C".
- Os nomes dos arquivos são os que a evidencia-api gera (ex.: `tela-1.png`), sem o prefixo do registro.
