import { Module } from '@nestjs/common';
import { HealthModule, JwtAuthGuard, TOKENS_REVOGADOS } from '@app/compartilhado';
import { CreditosDatabaseService, PostgresTokensRevogados } from '@app/infra';
import {
  ConsultarSaldoUseCase,
  CREDITOS_INICIAIS,
  creditosIniciaisDoAmbiente,
  CriarCarteiraUseCase,
  EfetivarReservaUseCase,
  LiberarReservaUseCase,
  ReservarCreditoUseCase,
} from './aplicacao';
import { CreditosController, CreditosInternosController } from './apresentacao';
import { UNIDADE_DE_TRABALHO_CREDITOS } from './dominio';
import { PostgresUnidadeDeTrabalhoCreditos } from './infra';

/**
 * Serviço Créditos e Pagamentos (comp. 07 Controle de Créditos).
 * Aqui é o único lugar que liga cada porta (interface) ao adaptador concreto.
 */
@Module({
  imports: [HealthModule.para('creditos-api')],
  controllers: [CreditosController, CreditosInternosController],
  providers: [
    CreditosDatabaseService,
    JwtAuthGuard,
    CriarCarteiraUseCase,
    ConsultarSaldoUseCase,
    ReservarCreditoUseCase,
    EfetivarReservaUseCase,
    LiberarReservaUseCase,
    { provide: CREDITOS_INICIAIS, useFactory: creditosIniciaisDoAmbiente },
    { provide: UNIDADE_DE_TRABALHO_CREDITOS, useClass: PostgresUnidadeDeTrabalhoCreditos },
    {
      provide: TOKENS_REVOGADOS,
      useFactory: (db: CreditosDatabaseService) => new PostgresTokensRevogados(db),
      inject: [CreditosDatabaseService],
    },
  ],
})
export class AppModule {}
