/**
 * Erros de domínio: a regra de negócio lança estes erros e NÃO conhece HTTP.
 * Quem traduz para status HTTP é o FiltroErrosDominio (camada de entrada).
 */
export abstract class ErroDominio extends Error {
  abstract readonly codigo: string;

  constructor(mensagem: string) {
    super(mensagem);
    this.name = new.target.name;
  }
}

export class RecursoNaoEncontrado extends ErroDominio {
  readonly codigo = 'NAO_ENCONTRADO';
}

export class AcessoNegado extends ErroDominio {
  readonly codigo = 'ACESSO_NEGADO';
}

export class Conflito extends ErroDominio {
  readonly codigo = 'CONFLITO';
}

export class RegraDeNegocioViolada extends ErroDominio {
  readonly codigo = 'REGRA_VIOLADA';
}

export class CreditosInsuficientes extends ErroDominio {
  readonly codigo = 'CREDITOS_INSUFICIENTES';
}
