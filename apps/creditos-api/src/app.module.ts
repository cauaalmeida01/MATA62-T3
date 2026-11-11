import { Module } from '@nestjs/common';
import { HealthModule } from '@app/compartilhado';

/**
 * Serviço Créditos e Pagamentos (comp. 07 Controle de Créditos).
 * Esqueleto: por enquanto só responde GET /api/health.
 * Os módulos de domínio entram aqui conforme docs/contratos.md.
 */
@Module({
  imports: [HealthModule.para('creditos-api')],
})
export class AppModule {}
