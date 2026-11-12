import { CreditosInsuficientes, RegraDeNegocioViolada } from '@app/compartilhado';

/**
 * Carteira de créditos de um usuário (comp. 07 Controle de Créditos).
 *   disponivel: créditos que podem ser usados agora
 *   reservado:  créditos separados para capturas em andamento
 * As regras de saldo moram aqui; a classe não conhece HTTP nem SQL.
 */
export class Carteira {
  constructor(
    readonly userId: string,
    private _disponivel: number,
    private _reservado: number,
  ) {}

  static nova(userId: string, creditosIniciais: number): Carteira {
    if (!Number.isInteger(creditosIniciais) || creditosIniciais < 0) {
      throw new RegraDeNegocioViolada('Créditos iniciais precisam ser um inteiro não negativo');
    }
    return new Carteira(userId, creditosIniciais, 0);
  }

  get disponivel(): number {
    return this._disponivel;
  }

  get reservado(): number {
    return this._reservado;
  }

  /** 1ª fase: separa os créditos. Sem saldo, recusa. */
  reservar(quantidade: number): void {
    Carteira.validarQuantidade(quantidade);
    if (this._disponivel < quantidade) {
      throw new CreditosInsuficientes('Sem créditos disponíveis');
    }
    this._disponivel -= quantidade;
    this._reservado += quantidade;
  }

  /** 2ª fase, sucesso: o crédito reservado é consumido de vez. */
  efetivar(quantidade: number): void {
    Carteira.validarQuantidade(quantidade);
    this.garantirReservado(quantidade);
    this._reservado -= quantidade;
  }

  /** 2ª fase, falha: o crédito reservado volta para o disponível. */
  liberar(quantidade: number): void {
    Carteira.validarQuantidade(quantidade);
    this.garantirReservado(quantidade);
    this._reservado -= quantidade;
    this._disponivel += quantidade;
  }

  private garantirReservado(quantidade: number): void {
    if (this._reservado < quantidade) {
      throw new RegraDeNegocioViolada('Carteira com menos créditos reservados do que a reserva');
    }
  }

  private static validarQuantidade(quantidade: number): void {
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw new RegraDeNegocioViolada('A quantidade precisa ser um inteiro positivo');
    }
  }
}
