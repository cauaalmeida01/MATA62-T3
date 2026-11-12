import { Carteira } from '../carteira.entity';
import { Reserva } from '../reserva.entity';

/**
 * O que os casos de uso precisam do banco, sem saber que é PostgreSQL.
 * Os métodos "ParaAtualizar" travam a linha até o fim da transação
 * (no adaptador: SELECT ... FOR UPDATE).
 */
export interface IRepositorioCreditos {
  buscarCarteira(userId: string): Promise<Carteira | null>;
  buscarCarteiraParaAtualizar(userId: string): Promise<Carteira | null>;
  /** @returns false se a carteira já existia (nada é alterado). */
  criarCarteiraSeNaoExistir(carteira: Carteira): Promise<boolean>;
  salvarCarteira(carteira: Carteira): Promise<void>;

  buscarReservaParaAtualizar(reservaId: string): Promise<Reserva | null>;
  buscarReservaPorSolicitacao(solicitacaoId: string): Promise<Reserva | null>;
  inserirReserva(reserva: Reserva): Promise<void>;
  salvarReserva(reserva: Reserva): Promise<void>;
}

/**
 * Unidade de trabalho: tudo o que for feito com o repositório dentro de executar()
 * acontece numa transação só (tudo ou nada). É a parte "A" do ACID.
 */
export const UNIDADE_DE_TRABALHO_CREDITOS = Symbol('UNIDADE_DE_TRABALHO_CREDITOS');

export interface IUnidadeDeTrabalhoCreditos {
  executar<T>(trabalho: (repositorio: IRepositorioCreditos) => Promise<T>): Promise<T>;
}
