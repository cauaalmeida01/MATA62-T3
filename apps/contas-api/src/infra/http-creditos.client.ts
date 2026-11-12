import { ICreditosClient } from '../dominio';

/** Cliente HTTP da rota interna POST /api/internal/carteiras da creditos-api. */
export class HttpCreditosClient implements ICreditosClient {
  private readonly baseUrl = (process.env.CREDITOS_URL ?? 'http://creditos-api:3000/api').replace(/\/+$/, '');

  async criarCarteira(userId: string): Promise<void> {
    const resposta = await fetch(`${this.baseUrl}/internal/carteiras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId }),
      signal: AbortSignal.timeout(5000),
    });
    if (!resposta.ok) {
      throw new Error(`creditos-api respondeu ${resposta.status} ao criar a carteira`);
    }
  }
}
