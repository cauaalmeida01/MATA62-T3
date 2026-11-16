/**
 * Porta da lista de tokens revogados (logout, REQ04).
 * A contas-api grava; todo serviço que valida token consulta.
 * A implementação com PostgreSQL fica em libs/infra (PostgresTokensRevogados).
 */
export const TOKENS_REVOGADOS = Symbol('TOKENS_REVOGADOS');

export interface ITokensRevogados {
  revogar(jti: string, expiraEm: Date): Promise<void>;
  estaRevogado(jti: string): Promise<boolean>;
}
