import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CREDITOS_WORKER_CLIENT,
  ICreditosClient,
  ISolicitacaoWorkerRepository,
  SOLICITACAO_WORKER_REPOSITORY,
} from '../dominio';

export const MOTIVO_RECONCILIACAO_TIMEOUT =
  'Timeout: solicitação expirada pelo job de reconciliação';

export interface ResultadoReconciliacao {
  totalEncontradas: number;
  reconciliadasComSucesso: number;
  falhas: number;
}

@Injectable()
export class ReconciliarSolicitacoesTravadasUseCase {
  private readonly logger = new Logger(ReconciliarSolicitacoesTravadasUseCase.name);

  constructor(
    @Inject(SOLICITACAO_WORKER_REPOSITORY)
    private readonly solicitacaoRepository: ISolicitacaoWorkerRepository,
    @Inject(CREDITOS_WORKER_CLIENT)
    private readonly creditosClient: ICreditosClient,
  ) {}

  async executar(minutosLimite = 15): Promise<ResultadoReconciliacao> {
    const travadas =
      await this.solicitacaoRepository.listarPendentesOuProcessandoTravadas(minutosLimite);

    let reconciliadasComSucesso = 0;
    let falhas = 0;

    for (const solicitacao of travadas) {
      try {
        await this.creditosClient.liberarReserva(
          solicitacao.reservaId,
          MOTIVO_RECONCILIACAO_TIMEOUT,
        );
        await this.solicitacaoRepository.marcarFalhou(
          solicitacao.id,
          MOTIVO_RECONCILIACAO_TIMEOUT,
        );
        reconciliadasComSucesso++;
        this.logger.log(
          `Solicitação travada ${solicitacao.id} reconciliada (reserva ${solicitacao.reservaId} liberada)`,
        );
      } catch (erro) {
        falhas++;
        this.logger.error(
          `Erro ao reconciliar solicitação travada ${solicitacao.id} (reserva ${solicitacao.reservaId})`,
          erro,
        );
      }
    }

    return {
      totalEncontradas: travadas.length,
      reconciliadasComSucesso,
      falhas,
    };
  }
}
