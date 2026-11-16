import { Cpf } from '../cpf';

/**
 * Protege o CPF (Privacidade, LGPD). Duas coisas diferentes:
 *  - cifrar: dá para decifrar com a chave, se um dia for preciso mostrar o CPF ao titular;
 *  - hashParaBusca: não dá para desfazer; serve só para saber se o CPF já foi cadastrado.
 */
export const PROTETOR_CPF = Symbol('PROTETOR_CPF');

export interface IProtetorCpf {
  cifrar(cpf: Cpf): string;
  hashParaBusca(cpf: Cpf): string;
}
