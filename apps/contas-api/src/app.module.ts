import { Module } from '@nestjs/common';
import { HealthModule } from '@app/compartilhado';

/**
 * Serviço Contas (comp. 01 Cadastro de Usuário, 02 Acesso e Sessão).
 * Esqueleto: por enquanto só responde GET /api/health.
 * Os módulos de domínio entram aqui conforme docs/contratos.md.
 */
@Module({
  imports: [HealthModule.para('contas-api')],
})
export class AppModule {}
