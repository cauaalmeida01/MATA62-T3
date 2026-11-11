import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '@app/compartilhado';
import { ReservaJaLiberada } from '../dominio/erros';
import { CreditosClient } from '../dominio/portas';

export const CREDITOS_URL = Symbol('CREDITOS_URL');

/**
 * Adaptador HTTP do CreditosClient: fala com a rota interna da creditos-api
 * (POST /api/internal/reservas/:id/efetivar, docs/contratos.md seção 3).
 *
 * Exemplo central de DIP do trabalho: ConcluirRegistro só conhece a interface
 * CreditosClient. Trocar HTTP por fila, ou por um dublê nos testes, não muda o caso de uso.
 */
@Injectable()
export class CreditosClientHttp implements CreditosClient {
  constructor(@Inject(CREDITOS_URL) private readonly baseUrl: string) {}

  async efetivar(reservaId: string): Promise<void> {
    const url = `${this.baseUrl}/internal/reservas/${encodeURIComponent(reservaId)}/efetivar`;
    const resposta = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(5000) });

    if (resposta.ok) return; // 200 também quando já estava efetivada (idempotente)
    if (resposta.status === 409) throw new ReservaJaLiberada(reservaId);
    if (resposta.status === 404) throw new RecursoNaoEncontrado(`Reserva ${reservaId} não encontrada`);
    // Qualquer outra falha sobe como erro técnico: vira 500 e o worker tenta de novo.
    throw new Error(`creditos-api respondeu ${resposta.status} ao efetivar a reserva ${reservaId}`);
  }
}
