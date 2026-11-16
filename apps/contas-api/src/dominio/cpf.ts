import { RegraDeNegocioViolada } from '@app/compartilhado';

/**
 * Objeto de valor CPF: só existe se for válido (11 dígitos e dígitos verificadores certos).
 * Guarda apenas os números, sem pontos e traço.
 */
export class Cpf {
  private constructor(readonly digitos: string) {}

  static criar(texto: string): Cpf {
    const digitos = (texto ?? '').replace(/\D/g, '');
    if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) {
      throw new RegraDeNegocioViolada('CPF inválido');
    }
    if (Cpf.digitoVerificador(digitos, 9) !== Number(digitos[9]) || Cpf.digitoVerificador(digitos, 10) !== Number(digitos[10])) {
      throw new RegraDeNegocioViolada('CPF inválido');
    }
    return new Cpf(digitos);
  }

  /** Regra da Receita: soma ponderada dos primeiros n dígitos, resto da divisão por 11. */
  private static digitoVerificador(digitos: string, n: number): number {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(digitos[i]) * (n + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  }
}
