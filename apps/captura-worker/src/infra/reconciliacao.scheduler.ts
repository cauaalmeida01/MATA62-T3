import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ReconciliarSolicitacoesTravadasUseCase } from '../aplicacao';

@Injectable()
export class ReconciliacaoScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliacaoScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly intervaloMs: number;
  private readonly minutosLimite: number;

  constructor(
    private readonly reconciliarUseCase: ReconciliarSolicitacoesTravadasUseCase,
  ) {
    this.intervaloMs = Number(process.env.RECONCILIACAO_INTERVALO_MS ?? 60_000);
    this.minutosLimite = Number(process.env.RECONCILIACAO_TIMEOUT_MINUTOS ?? 15);
  }

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    this.logger.log(
      `Job de reconciliação agendado a cada ${this.intervaloMs}ms (limite: ${this.minutosLimite} min)`,
    );

    this.timer = setInterval(() => {
      void this.executarCiclo();
    }, this.intervaloMs);
  }

  async executarCiclo(): Promise<void> {
    try {
      const resultado = await this.reconciliarUseCase.executar(this.minutosLimite);
      if (resultado.totalEncontradas > 0) {
        this.logger.log(
          `Ciclo de reconciliação concluído: ${resultado.reconciliadasComSucesso}/${resultado.totalEncontradas} solicitações destravadas`,
        );
      }
    } catch (erro) {
      this.logger.error('Erro durante execução do job de reconciliação', erro);
    }
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
