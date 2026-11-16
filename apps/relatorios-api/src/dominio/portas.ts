import { Registro } from './registro';

/**
 * Portas do domínio (DIP): os casos de uso dependem destas abstrações,
 * e a camada de infra fornece as implementações (Prisma, HTTP).
 * Cada interface tem só o que os casos de uso usam (ISP).
 */

/** Tokens de injeção: interfaces somem em tempo de execução, os símbolos não. */
export const REGISTRO_REPOSITORIO = Symbol('RegistroRepositorio');
export const CREDITOS_CLIENT = Symbol('CreditosClient');

export interface RegistroRepositorio {
  buscarPorId(id: string): Promise<Registro | null>;
  buscarPorSolicitacao(solicitacaoId: string): Promise<Registro | null>;
  listarPorUsuario(userId: string): Promise<Registro[]>;
  /**
   * Salva um registro novo. Se outro já foi salvo para a mesma solicitação
   * (corrida entre duas chamadas), devolve o que já existia.
   */
  salvar(registro: Registro): Promise<Registro>;
}

/** O que a relatorios-api precisa do serviço Créditos e Pagamentos. */
export interface CreditosClient {
  /**
   * Efetiva a reserva (o crédito é consumido de vez). Idempotente:
   * efetivar de novo uma reserva efetivada não é erro.
   * Lança ReservaJaLiberada se a reserva foi liberada antes (ex.: pela DLQ).
   */
  efetivar(reservaId: string): Promise<void>;
}
