import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado, RegraDeNegocioViolada } from '@app/compartilhado';
import { Carteira, IUnidadeDeTrabalhoCreditos, Reserva, StatusReserva, UNIDADE_DE_TRABALHO_CREDITOS } from '../dominio';

export interface EncerrarReservaOutput {
  reservaId: string;
  status: StatusReserva;
}

/**
 * 2ª fase do débito. Efetivar e liberar seguem o mesmo roteiro e só mudam
 * a operação, então os dois casos de uso compartilham esta base (as subclasses
 * só dizem o que fazer na reserva e na carteira).
 * Ordem das travas: primeiro a reserva, depois a carteira. Assim duas chamadas
 * para a mesma reserva (ex.: efetivar e liberar ao mesmo tempo) ficam em fila.
 */
abstract class EncerrarReservaUseCase {
  constructor(private readonly uow: IUnidadeDeTrabalhoCreditos) {}

  /** Muda o status da reserva. @returns false se ela já estava no status pedido. */
  protected abstract aplicarNaReserva(reserva: Reserva): boolean;
  /** Ajusta o saldo da carteira. */
  protected abstract aplicarNaCarteira(carteira: Carteira, quantidade: number): void;

  async executar(reservaId: string): Promise<EncerrarReservaOutput> {
    return this.uow.executar(async (repo) => {
      const reserva = await repo.buscarReservaParaAtualizar(reservaId);
      if (!reserva) {
        throw new RecursoNaoEncontrado('Reserva não encontrada');
      }

      const mudou = this.aplicarNaReserva(reserva); // Conflito (409) se já foi encerrada do outro jeito
      if (mudou) {
        const carteira = await repo.buscarCarteiraParaAtualizar(reserva.userId);
        if (!carteira) {
          throw new RegraDeNegocioViolada('Reserva sem carteira');
        }
        this.aplicarNaCarteira(carteira, reserva.quantidade);
        await repo.salvarCarteira(carteira);
        await repo.salvarReserva(reserva);
      }
      return { reservaId: reserva.id, status: reserva.status };
    });
  }
}

/** Chamado pela relatorios-api quando a captura é concluída (REQ11). */
@Injectable()
export class EfetivarReservaUseCase extends EncerrarReservaUseCase {
  constructor(@Inject(UNIDADE_DE_TRABALHO_CREDITOS) uow: IUnidadeDeTrabalhoCreditos) {
    super(uow);
  }

  protected aplicarNaReserva(reserva: Reserva): boolean {
    return reserva.efetivar();
  }

  protected aplicarNaCarteira(carteira: Carteira, quantidade: number): void {
    carteira.efetivar(quantidade);
  }
}

/** Chamado pelo consumidor da DLQ e pela reconciliação quando a captura falha. */
@Injectable()
export class LiberarReservaUseCase extends EncerrarReservaUseCase {
  constructor(@Inject(UNIDADE_DE_TRABALHO_CREDITOS) uow: IUnidadeDeTrabalhoCreditos) {
    super(uow);
  }

  protected aplicarNaReserva(reserva: Reserva): boolean {
    return reserva.liberar();
  }

  protected aplicarNaCarteira(carteira: Carteira, quantidade: number): void {
    carteira.liberar(quantidade);
  }
}
