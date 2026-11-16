import { Injectable, Logger } from '@nestjs/common';
import {
  FalhaIntegracaoWorkerError,
  IEvidenciaClient,
  PacoteEvidenciaSelado,
  SelarEvidenciaInput,
} from '../dominio';

@Injectable()
export class HttpEvidenciaClient implements IEvidenciaClient {
  private readonly logger = new Logger(HttpEvidenciaClient.name);
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = (process.env.EVIDENCIA_URL ?? 'http://evidencia-api:3000/api').replace(
      /\/+$/,
      '',
    );
  }

  async selarEvidencia(dados: SelarEvidenciaInput): Promise<PacoteEvidenciaSelado> {
    const formData = new FormData();
    formData.append('metadados', JSON.stringify(dados.metadados));

    for (const arquivo of dados.arquivos) {
      const bytes = new Uint8Array(arquivo.conteudo);
      const blob = new Blob([bytes], { type: arquivo.mimeType });
      formData.append('arquivos', blob, arquivo.nome);
    }

    let resposta: Response;
    try {
      resposta = await fetch(`${this.baseUrl}/internal/evidencias`, {
        method: 'POST',
        body: formData,
      });
    } catch (erro) {
      this.logger.error('Erro de rede ao enviar artefatos para evidencia-api', erro);
      throw new FalhaIntegracaoWorkerError('Serviço de evidências indisponível');
    }

    if (!resposta.ok) {
      const textoErro = await resposta.text().catch(() => '');
      throw new FalhaIntegracaoWorkerError(
        `Falha ao selar evidência na evidencia-api (status ${resposta.status}): ${textoErro}`,
      );
    }

    const pacote = (await resposta.json()) as PacoteEvidenciaSelado;
    if (!pacote?.evidenciaId || !pacote?.manifestoSha256) {
      throw new FalhaIntegracaoWorkerError(
        'Resposta inválida da evidencia-api: pacote selado incompleto',
      );
    }

    return pacote;
  }
}
