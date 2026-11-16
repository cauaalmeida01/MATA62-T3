import { Injectable, Logger } from '@nestjs/common';
import { FalhaIntegracaoWorkerError, ICreditosClient } from '../dominio';

@Injectable()
export class HttpCreditosWorkerClient implements ICreditosClient {
  private readonly logger = new Logger(HttpCreditosWorkerClient.name);
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = (process.env.CREDITOS_URL ?? 'http://creditos-api:3000/api').replace(
      /\/+$/,
      '',
    );
  }

  async liberarReserva(reservaId: string, motivo?: string): Promise<void> {
    let resposta: Response;
    try {
      resposta = await fetch(
        `${this.baseUrl}/internal/reservas/${encodeURIComponent(reservaId)}/liberar`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(motivo ? { motivo } : {}),
        },
      );
    } catch (erro) {
      this.logger.error(`Erro de rede ao liberar reserva ${reservaId}`, erro);
      throw new FalhaIntegracaoWorkerError('Serviço de créditos indisponível ao liberar reserva');
    }

    // 200 = liberada (ou já liberada); 404/409 = inexistente ou já efetivada (tratado de forma idempotente)
    if (resposta.ok || resposta.status === 404 || resposta.status === 409) {
      if (resposta.status === 409) {
        this.logger.warn(
          `Reserva ${reservaId} retornou 409 ao liberar (já efetivada anteriormente); prosseguindo de forma idempotente`,
        );
      }
      return;
    }

    throw new FalhaIntegracaoWorkerError(
      `Falha ao liberar reserva ${reservaId} na creditos-api (status ${resposta.status})`,
    );
  }
}
