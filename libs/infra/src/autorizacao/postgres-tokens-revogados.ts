import { ITokensRevogados } from '@app/compartilhado';
import { ExecutorSql } from '../postgres/banco-postgres';

/** Adaptador da porta ITokensRevogados sobre a tabela compartilhado.tokens_revogados. */
export class PostgresTokensRevogados implements ITokensRevogados {
  constructor(private readonly db: ExecutorSql) {}

  async revogar(jti: string, expiraEm: Date): Promise<void> {
    // Sair duas vezes com o mesmo token não é erro: ON CONFLICT DO NOTHING.
    await this.db.query(
      `INSERT INTO compartilhado.tokens_revogados (jti, expira_em) VALUES ($1, $2)
       ON CONFLICT (jti) DO NOTHING`,
      [jti, expiraEm],
    );
  }

  async estaRevogado(jti: string): Promise<boolean> {
    const r = await this.db.query(
      `SELECT 1 FROM compartilhado.tokens_revogados WHERE jti = $1 AND expira_em > NOW()`,
      [jti],
    );
    return (r.rowCount ?? 0) > 0;
  }
}
