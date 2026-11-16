import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CREDITOS_WORKER_CLIENT,
  ICreditosClient,
  ISolicitacaoWorkerRepository,
  MensagemFilaCapturaV1,
  SOLICITACAO_WORKER_REPOSITORY,
} from '../dominio';

@Injectable()
export class ProcessarDlqUseCase {
  private readonly logger = new Logger(ProcessarDlqUseCase.name);

  constructor(
    @Inject(SOLICITACAO_WORKER_REPOSITORY)
    private readonly solicitacaoRepository: ISolicitacaoWorkerRepository,
    @Inject(CREDITOS_WORKER_CLIENT)
    private readonly creditosClient: ICreditosClient,
  ) {}

  async executar(mensagem: MensagemFilaCapturaV1): Promise<void> {
    const solicitacao = await this.solicitacaoRepository.buscarPorId(mensagem.solicitacaoId);

    if (solicitacao?.status === 'CONCLUIDA') {
      this.logger.warn(
        `Mensagem na DLQ para solicitação ${mensagem.solicitacaoId} que já está CONCLUIDA; ignorando liberação`,
      );
      return;
    }

    const motivoPadrao = 'Falha definitiva após 3 tentativas de captura (DLQ)';
    const motivoFinal = solicitacao?.ultimoErro
      ? `${motivoPadrao}: ${solicitacao.ultimoErro}`
      : motivoPadrao;

    await this.creditosClient.liberarReserva(mensagem.reservaId, motivoFinal);
    await this.solicitacaoRepository.marcarFalhou(mensagem.solicitacaoId, motivoFinal);

    this.logger.log(
      `Solicitação ${mensagem.solicitacaoId} marcada como FALHOU e reserva ${mensagem.reservaId} liberada via DLQ`,
    );
  }
}
