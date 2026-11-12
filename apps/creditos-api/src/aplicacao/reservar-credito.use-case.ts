import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '@app/compartilhado';
import { IUnidadeDeTrabalhoCreditos, Reserva, UNIDADE_DE_TRABALHO_CREDITOS } from '../dominio';

export interface ReservarCreditoCommand {
  userId: string;
  solicitacaoId: string;
  quantidade: number;
}

/**
 * 1ª fase do débito (REQ08). Numa transação só:
 *   1. trava a linha da carteira (FOR UPDATE): um segundo pedido do mesmo usuário espera aqui;
 *   2. se esta solicitação já tem reserva, devolve a mesma (a registro-api pode repetir o pedido);
 *   3. tira do disponível, põe no reservado e grava a reserva.
 */
@Injectable()
export class ReservarCreditoUseCase {
  constructor(@Inject(UNIDADE_DE_TRABALHO_CREDITOS) private readonly uow: IUnidadeDeTrabalhoCreditos) {}

  async executar(comando: ReservarCreditoCommand): Promise<{ reservaId: string }> {
    return this.uow.executar(async (repo) => {
      const carteira = await repo.buscarCarteiraParaAtualizar(comando.userId);
      if (!carteira) {
        throw new RecursoNaoEncontrado('Carteira não encontrada');
      }

      const existente = await repo.buscarReservaPorSolicitacao(comando.solicitacaoId);
      if (existente) {
        return { reservaId: existente.id };
      }

      carteira.reservar(comando.quantidade); // lança CreditosInsuficientes (402) se faltar saldo
      const reserva = Reserva.nova({
        id: randomUUID(),
        userId: comando.userId,
        solicitacaoId: comando.solicitacaoId,
        quantidade: comando.quantidade,
      });
      await repo.salvarCarteira(carteira);
      await repo.inserirReserva(reserva);
      return { reservaId: reserva.id };
    });
  }
}
