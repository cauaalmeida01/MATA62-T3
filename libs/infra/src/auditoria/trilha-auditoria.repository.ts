import { createHash, randomUUID } from 'node:crypto';
import { ExecutorSql } from '../postgres/banco-postgres';

/** Tabela compartilhada de auditoria: escrita centralizada neste adaptador. */
export const DDL_TRILHA_AUDITORIA = `
CREATE SCHEMA IF NOT EXISTS compartilhado;
CREATE TABLE IF NOT EXISTS compartilhado.trilha_auditoria (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  acao TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  dados JSONB NOT NULL,
  hash_anterior CHAR(64) NULL,
  hash CHAR(64) NOT NULL UNIQUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trilha_auditoria_entidade
  ON compartilhado.trilha_auditoria (entidade_id);
`;

/**
 * O executor é a MESMA transação que grava a evidência.
 * Advisory lock serializa a cadeia hash para não criar duas cabeças simultâneas.
 */
export class TrilhaAuditoriaRepository {
  async registrar(
    executor: ExecutorSql,
    entrada: { userId: string; acao: string; entidadeId: string; dados: Record<string, unknown> },
  ): Promise<void> {
    await executor.query('SELECT pg_advisory_xact_lock(745621, 1)');
    const anterior = await executor.query<{ hash: string }>(
      'SELECT hash FROM compartilhado.trilha_auditoria ORDER BY criado_em DESC, id DESC LIMIT 1',
    );
    const hashAnterior = anterior.rows[0]?.hash ?? null;
    const id = randomUUID();
    const criadoEm = new Date().toISOString();
    const hash = createHash('sha256')
      .update(JSON.stringify({
        id,
        criadoEm,
        hashAnterior,
        userId: entrada.userId,
        acao: entrada.acao,
        entidadeId: entrada.entidadeId,
        dados: entrada.dados,
      }))
      .digest('hex');
    await executor.query(
      `INSERT INTO compartilhado.trilha_auditoria
        (id, user_id, acao, entidade_id, dados, hash_anterior, hash, criado_em)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
      [id, entrada.userId, entrada.acao, entrada.entidadeId, JSON.stringify(entrada.dados),
        hashAnterior, hash, criadoEm],
    );
  }
}
