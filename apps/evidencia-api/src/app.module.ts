import { Module } from '@nestjs/common';
import { HealthModule } from '@app/compartilhado';

/**
 * Serviço Evidência (comp. 11 a 14 e trilha).
 * Esqueleto: por enquanto só responde GET /api/health.
 * Os módulos de domínio entram aqui conforme docs/contratos.md.
 */
@Module({
  imports: [HealthModule.para('evidencia-api')],
})
export class AppModule {}
