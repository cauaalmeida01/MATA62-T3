import { ErroDominio, RegraDeNegocioViolada } from '@app/compartilhado';

/**
 * Lançado quando a URL informada possui protocolo inválido, formato incorreto
 * ou resolve para endereços IP/hosts internos bloqueados pela política anti-SSRF.
 */
export class UrlInvalidaOuBloqueadaError extends RegraDeNegocioViolada {
  constructor(mensagem = 'URL inválida ou bloqueada pela política de segurança') {
    super(mensagem);
  }
}

/**
 * Lançado quando uma comunicação com serviço interno ou fila falha de forma inesperada.
 */
export class FalhaIntegracaoInternaError extends ErroDominio {
  readonly codigo = 'ERRO_INTERNO';

  constructor(mensagem = 'Falha na comunicação com serviço interno') {
    super(mensagem);
  }
}
