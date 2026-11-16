import { Injectable, Logger } from '@nestjs/common';
import {
  ConclusaoRegistroPayload,
  FalhaIntegracaoWorkerError,
  IRelatoriosClient,
} from '../dominio';

@Injectable()
export class HttpRelatoriosClient implements IRelatoriosClient {
  private readonly logger = new Logger(HttpRelatoriosClient.name);
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = (process.env.RELATORIOS_URL ?? 'http://relatorios-api:3000/api').replace(
      /\/+$/,
      '',
    );
  }

  async concluirRegistro(
    solicitacaoId: string,
    payload: ConclusaoRegistroPayload,
  ): Promise<{ registroId: string }> {
    let resposta: Response;
    try {
      resposta = await fetch(
        `${this.baseUrl}/internal/registros/${encodeURIComponent(solicitacaoId)}/conclusao`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
    } catch (erro) {
      this.logger.error('Erro de rede ao concluir registro na relatorios-api', erro);
      throw new FalhaIntegracaoWorkerError('Serviço de relatórios indisponível');
    }

    if (!resposta.ok) {
      const textoErro = await resposta.text().catch(() => '');
      throw new FalhaIntegracaoWorkerError(
        `Falha ao concluir registro na relatorios-api (status ${resposta.status}): ${textoErro}`,
      );
    }

    const corpo = (await resposta.json().catch(() => ({}))) as { registroId?: string };
    return { registroId: corpo.registroId ?? solicitacaoId };
  }
}
