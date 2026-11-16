import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

/** O mínimo que um repositório precisa para rodar SQL, dentro ou fora de transação. */
export interface ExecutorSql {
  query<T extends QueryResultRow = QueryResultRow>(texto: string, parametros?: unknown[]): Promise<QueryResult<T>>;
}

/** Esquema "compartilhado": lista de tokens revogados no logout (docs/contratos.md, seção 6). */
export const DDL_TOKENS_REVOGADOS = `
CREATE SCHEMA IF NOT EXISTS compartilhado;
CREATE TABLE IF NOT EXISTS compartilhado.tokens_revogados (
  jti TEXT PRIMARY KEY,
  expira_em TIMESTAMPTZ NOT NULL
);
`;

/**
 * Conexão com o PostgreSQL compartilhado (ADR-005 do T2). Cada serviço estende esta
 * classe com o DDL do próprio esquema, que é criado ao subir (CREATE ... IF NOT EXISTS).
 */
export abstract class BancoPostgres implements ExecutorSql, OnModuleInit, OnModuleDestroy {
  protected readonly logger = new Logger(this.constructor.name);
  protected readonly pool: Pool;

  protected constructor(private readonly ddl: string) {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL ?? 'postgresql://veridit:veridit@localhost:5432/veridit',
    });
  }

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    await this.garantirSchema();
  }

  async garantirSchema(): Promise<void> {
    // Dois serviços subindo juntos podem criar o mesmo esquema ao mesmo tempo; o
    // PostgreSQL acusa duplicidade (23505/42P07) em um deles. Basta tentar de novo.
    for (let tentativa = 1; ; tentativa++) {
      try {
        await this.pool.query(this.ddl);
        this.logger.log('Esquema do banco verificado');
        return;
      } catch (erro) {
        const codigo = (erro as { code?: string }).code;
        if (tentativa >= 3 || (codigo !== '23505' && codigo !== '42P07')) throw erro;
      }
    }
  }

  query<T extends QueryResultRow = QueryResultRow>(texto: string, parametros?: unknown[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(texto, parametros);
  }

  /**
   * Roda o trabalho numa transação: BEGIN, COMMIT se deu certo, ROLLBACK se lançou erro.
   * Tudo dentro usa a mesma conexão, então as travas (FOR UPDATE) valem até o fim.
   */
  async transacao<T>(trabalho: (cliente: ExecutorSql) => Promise<T>): Promise<T> {
    const cliente: PoolClient = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const resultado = await trabalho(cliente);
      await cliente.query('COMMIT');
      return resultado;
    } catch (erro) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      throw erro;
    } finally {
      cliente.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
