import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';

export const DDL_SCHEMA_REGISTRO = `
CREATE SCHEMA IF NOT EXISTS registro;

CREATE TABLE IF NOT EXISTS registro.solicitacoes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  titulo TEXT NOT NULL,
  modo VARCHAR(32) NOT NULL DEFAULT 'TELA',
  status VARCHAR(32) NOT NULL,
  reserva_id UUID NOT NULL,
  ultimo_erro TEXT NULL,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registro_solicitacoes_user_id
  ON registro.solicitacoes (user_id);

CREATE INDEX IF NOT EXISTS idx_registro_solicitacoes_status_atualizada_em
  ON registro.solicitacoes (status, atualizada_em);
`;

@Injectable()
export class RegistroDatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RegistroDatabaseService.name);
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ?? 'postgresql://veridit:veridit@localhost:5432/veridit',
    });
  }

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    await this.garantirSchema();
  }

  async garantirSchema(): Promise<void> {
    await this.pool.query(DDL_SCHEMA_REGISTRO);
    this.logger.log('Schema PostgreSQL "registro" e tabela "registro.solicitacoes" verificados');
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    texto: string,
    parametros?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(texto, parametros);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
