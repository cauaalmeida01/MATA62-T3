import { Conflito } from '@app/compartilhado';

export type StatusReserva = 'RESERVADA' | 'EFETIVADA' | 'LIBERADA';

export interface ReservaProps {
  id: string;
  userId: string;
  solicitacaoId: string;
  quantidade: number;
  status: StatusReserva;
  criadaEm: Date;
  encerradaEm: Date | null;
}

/**
 * Reserva de crédito para uma solicitação de registro (ADR-004 do T2, débito em duas fases).
 *
 *   RESERVADA ──efetivar──> EFETIVADA   (captura concluída)
 *       └──────liberar────> LIBERADA    (captura falhou)
 *
 * Uma reserva só é encerrada uma vez. Repetir a mesma operação não muda nada
 * (idempotente: devolve false); fazer a operação oposta é Conflito (409).
 */
export class Reserva {
  readonly id: string;
  readonly userId: string;
  readonly solicitacaoId: string;
  readonly quantidade: number;
  readonly criadaEm: Date;
  private _status: StatusReserva;
  private _encerradaEm: Date | null;

  constructor(props: ReservaProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.solicitacaoId = props.solicitacaoId;
    this.quantidade = props.quantidade;
    this.criadaEm = props.criadaEm;
    this._status = props.status;
    this._encerradaEm = props.encerradaEm;
  }

  static nova(props: { id: string; userId: string; solicitacaoId: string; quantidade: number; agora?: Date }): Reserva {
    return new Reserva({ ...props, status: 'RESERVADA', criadaEm: props.agora ?? new Date(), encerradaEm: null });
  }

  get status(): StatusReserva {
    return this._status;
  }

  get encerradaEm(): Date | null {
    return this._encerradaEm;
  }

  /** @returns true se a reserva mudou agora; false se já estava efetivada. */
  efetivar(agora = new Date()): boolean {
    return this.encerrar('EFETIVADA', agora);
  }

  /** @returns true se a reserva mudou agora; false se já estava liberada. */
  liberar(agora = new Date()): boolean {
    return this.encerrar('LIBERADA', agora);
  }

  private encerrar(destino: 'EFETIVADA' | 'LIBERADA', agora: Date): boolean {
    if (this._status === destino) return false;
    if (this._status !== 'RESERVADA') {
      throw new Conflito(`A reserva já foi ${this._status === 'EFETIVADA' ? 'efetivada' : 'liberada'}`);
    }
    this._status = destino;
    this._encerradaEm = agora;
    return true;
  }
}
