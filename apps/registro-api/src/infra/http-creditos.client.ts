import { Injectable, Logger } from '@nestjs/common';
import { CreditosInsuficientes } from '@app/compartilhado';
import {
  FalhaIntegracaoInternaError,
  ICreditosClient,
  ReservarCreditoInput,
  ReservarCreditoOutput,
} from '../dominio';

@Injectable()
export class HttpCreditosClient implements ICreditosClient {
  private readonly logger = new Logger(HttpCreditosClient.name);
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = (process.env.CREDITOS_URL ?? 'http://creditos-api:3000/api').replace(/\/+$/, '');
  }

  async reservarCredito(input: ReservarCreditoInput): Promise<ReservarCreditoOutput> {
    let resposta: Response;
    try {
      resposta = await fetch(`${this.baseUrl}/internal/reservas`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: input.userId,
          solicitacaoId: input.solicitacaoId,
          quantidade: input.quantidade,
        }),
      });
    } catch (erro) {
      this.logger.error('Erro de rede ao chamar creditos-api para reservar crédito', erro);
      throw new FalhaIntegracaoInternaError('Serviço de créditos indisponível no momento');
    }

    const corpo = await this.lerJsonSeguro(resposta);

    if (resposta.status === 402) {
      const mensagem =
        corpo?.erro?.mensagem ?? 'Sem créditos disponíveis para realizar a solicitação';
      throw new CreditosInsuficientes(mensagem);
    }

    if (!resposta.ok || typeof corpo?.reservaId !== 'string') {
      this.logger.error(
        `Resposta inesperada de creditos-api ao reservar crédito (status ${resposta.status})`,
      );
      throw new FalhaIntegracaoInternaError('Não foi possível reservar crédito para a solicitação');
    }

    return { reservaId: corpo.reservaId };
  }

  async liberarReserva(reservaId: string): Promise<void> {
    let resposta: Response;
    try {
      resposta = await fetch(
        `${this.baseUrl}/internal/reservas/${encodeURIComponent(reservaId)}/liberar`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
        },
      );
    } catch (erro) {
      this.logger.error(`Erro de rede ao liberar reserva ${reservaId}`, erro);
      throw new FalhaIntegracaoInternaError('Serviço de créditos indisponível ao liberar reserva');
    }

    if (!resposta.ok) {
      throw new FalhaIntegracaoInternaError(
        `Falha ao liberar reserva ${reservaId} (status ${resposta.status})`,
      );
    }
  }

  private async lerJsonSeguro(
    resposta: Response,
  ): Promise<{ reservaId?: string; erro?: { codigo?: string; mensagem?: string } } | null> {
    try {
      return (await resposta.json()) as {
        reservaId?: string;
        erro?: { codigo?: string; mensagem?: string };
      };
    } catch {
      return null;
    }
  }
}
