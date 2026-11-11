import { Module } from '@nestjs/common';
import { HealthModule } from '@app/compartilhado';

/**
 * Serviço Registro e Captura (comp. 09 Solicitação de Registro).
 * Esqueleto: por enquanto só responde GET /api/health.
 * Os módulos de domínio entram aqui conforme docs/contratos.md.
 */
@Module({
  imports: [HealthModule.para('registro-api')],
})
export class AppModule {}
