import { Module } from '@nestjs/common';
import { HealthModule } from '@app/compartilhado';
import { RegistroDatabaseService } from '@app/infra';
import { ConsultarSolicitacaoUseCase, CriarSolicitacaoUseCase } from './aplicacao';
import { JwtAuthGuard, SolicitacoesController } from './apresentacao';
import {
  CREDITOS_CLIENT,
  FILA_CAPTURA_PUBLISHER,
  SOLICITACAO_REPOSITORY,
  VALIDADOR_URL_SEGURA,
} from './dominio';
import {
  DnsValidadorUrlSegura,
  HttpCreditosClient,
  PostgresSolicitacaoRepository,
  SqsFilaCapturaPublisher,
} from './infra';

/**
 * Serviço Registro e Captura (comp. 09 Solicitação de Registro).
 * Implementa as rotas públicas POST /api/solicitacoes e GET /api/solicitacoes/:id (REQ08).
 */
@Module({
  imports: [HealthModule.para('registro-api')],
  controllers: [SolicitacoesController],
  providers: [
    RegistroDatabaseService,
    JwtAuthGuard,
    CriarSolicitacaoUseCase,
    ConsultarSolicitacaoUseCase,
    {
      provide: SOLICITACAO_REPOSITORY,
      useClass: PostgresSolicitacaoRepository,
    },
    {
      provide: CREDITOS_CLIENT,
      useClass: HttpCreditosClient,
    },
    {
      provide: FILA_CAPTURA_PUBLISHER,
      useClass: SqsFilaCapturaPublisher,
    },
    {
      provide: VALIDADOR_URL_SEGURA,
      useFactory: () => new DnsValidadorUrlSegura(),
    },
  ],
})
export class AppModule {}
