import { Module } from '@nestjs/common';
import { HealthModule } from '@app/compartilhado';
import { SelarEvidenciaUseCase } from './aplicacao/selar-evidencia.use-case';
import { EvidenciasController } from './apresentacao/evidencias.controller';
import { ARMAZENAMENTO_EVIDENCIA, CARIMBADOR_TEMPO, EVIDENCIA_REPOSITORY } from './dominio';
import { EvidenciaDatabaseService } from './infra/evidencia-database.service';
import { PostgresEvidenciaRepository } from './infra/postgres-evidencia.repository';
import { Rfc3161Carimbador } from './infra/rfc3161-carimbador';
import { S3ArmazenamentoAdapter } from './infra/s3-armazenamento.adapter';

/** Serviço Evidência: selagem, armazenamento imutável, carimbo RFC 3161 e auditoria. */
@Module({
  imports: [HealthModule.para('evidencia-api')],
  controllers: [EvidenciasController],
  providers: [
    EvidenciaDatabaseService,
    SelarEvidenciaUseCase,
    { provide: EVIDENCIA_REPOSITORY, useClass: PostgresEvidenciaRepository },
    { provide: ARMAZENAMENTO_EVIDENCIA, useClass: S3ArmazenamentoAdapter },
    { provide: CARIMBADOR_TEMPO, useClass: Rfc3161Carimbador },
  ],
})
export class AppModule {}
