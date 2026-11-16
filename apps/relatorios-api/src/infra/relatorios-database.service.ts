import { Injectable } from '@nestjs/common';
import { BancoPostgres, DDL_TOKENS_REVOGADOS } from '@app/infra';

/**
 * Conexão pg usada só para consultar compartilhado.tokens_revogados (logout, REQ04),
 * pelo mesmo adaptador dos outros serviços (PostgresTokensRevogados).
 * As tabelas do esquema relatorios continuam no Prisma (PrismaService).
 */
@Injectable()
export class RelatoriosDatabaseService extends BancoPostgres {
  constructor() {
    super(DDL_TOKENS_REVOGADOS);
  }
}
