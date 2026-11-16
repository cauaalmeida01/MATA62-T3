import { Module } from '@nestjs/common';
import { RegistroDatabaseService } from '@app/infra';
import {
  ProcessarCapturaUseCase,
  ProcessarDlqUseCase,
  ReconciliarSolicitacoesTravadasUseCase,
} from './aplicacao';
import {
  CREDITOS_WORKER_CLIENT,
  EVIDENCIA_CLIENT,
  IValidadorUrlSegura,
  MOTOR_CAPTURA,
  RELATORIOS_CLIENT,
  SOLICITACAO_WORKER_REPOSITORY,
  VALIDADOR_URL_SEGURA_WORKER,
} from './dominio';
import {
  DnsValidadorUrlSeguraWorker,
  HttpCreditosWorkerClient,
  HttpEvidenciaClient,
  HttpRelatoriosClient,
  HttpSimplesMotorCaptura,
  PlaywrightMotorCaptura,
  PostgresSolicitacaoWorkerRepository,
  ReconciliacaoScheduler,
  SqsCapturaConsumer,
  SqsDlqConsumer,
} from './infra';

/**
 * Serviço Registro e Captura (comp. 10 Captura, worker da fila + DLQ + Job de Reconciliação).
 * Seleciona o motor de captura via `MOTOR_CAPTURA=playwright|http` (padrão: playwright).
 */
@Module({
  providers: [
    RegistroDatabaseService,
    PlaywrightMotorCaptura,
    HttpSimplesMotorCaptura,
    ProcessarCapturaUseCase,
    ProcessarDlqUseCase,
    ReconciliarSolicitacoesTravadasUseCase,
    SqsCapturaConsumer,
    SqsDlqConsumer,
    ReconciliacaoScheduler,
    {
      provide: SOLICITACAO_WORKER_REPOSITORY,
      useClass: PostgresSolicitacaoWorkerRepository,
    },
    {
      provide: VALIDADOR_URL_SEGURA_WORKER,
      useFactory: () => new DnsValidadorUrlSeguraWorker(),
    },
    {
      provide: MOTOR_CAPTURA,
      useFactory: (
        playwrightMotor: PlaywrightMotorCaptura,
        httpMotor: HttpSimplesMotorCaptura,
        validadorUrl: IValidadorUrlSegura,
      ) => {
        const modoMotor = (process.env.MOTOR_CAPTURA ?? 'playwright').toLowerCase();
        if (modoMotor === 'http') {
          return httpMotor ?? new HttpSimplesMotorCaptura(validadorUrl);
        }
        return playwrightMotor;
      },
      inject: [PlaywrightMotorCaptura, HttpSimplesMotorCaptura, VALIDADOR_URL_SEGURA_WORKER],
    },
    {
      provide: EVIDENCIA_CLIENT,
      useClass: HttpEvidenciaClient,
    },
    {
      provide: RELATORIOS_CLIENT,
      useClass: HttpRelatoriosClient,
    },
    {
      provide: CREDITOS_WORKER_CLIENT,
      useClass: HttpCreditosWorkerClient,
    },
  ],
})
export class WorkerModule {}
