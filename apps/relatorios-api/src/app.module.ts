import { Module } from '@nestjs/common';
import { HealthModule } from '@app/compartilhado';

/**
 * Serviço Registros e Relatórios (comp. 15 Conclusão, 18 Consulta).
 * Esqueleto: por enquanto só responde GET /api/health.
 * Os módulos de domínio entram aqui conforme docs/contratos.md.
 */
@Module({
  imports: [HealthModule.para('relatorios-api')],
})
export class AppModule {}
