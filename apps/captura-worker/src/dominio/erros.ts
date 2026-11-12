import { ErroDominio, RegraDeNegocioViolada } from '@app/compartilhado';

export class UrlInvalidaOuBloqueadaWorkerError extends RegraDeNegocioViolada {
  constructor(mensagem = 'URL inválida ou bloqueada pela política anti-SSRF no worker') {
    super(mensagem);
  }
}

export class FalhaCapturaError extends ErroDominio {
  readonly codigo = 'ERRO_INTERNO';

  constructor(mensagem = 'Falha durante a captura da página web') {
    super(mensagem);
  }
}

export class FalhaIntegracaoWorkerError extends ErroDominio {
  readonly codigo = 'ERRO_INTERNO';

  constructor(mensagem = 'Falha na comunicação com serviço interno durante o processamento') {
    super(mensagem);
  }
}
