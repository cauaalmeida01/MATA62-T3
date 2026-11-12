import { ExecutorSql } from '@app/infra';
import { Carteira, IRepositorioCreditos, Reserva, StatusReserva } from '../dominio';

interface LinhaCarteira {
  user_id: string;
  disponivel: number;
  reservado: number;
}

interface LinhaReserva {
  id: string;
  user_id: string;
  solicitacao_id: string;
  quantidade: number;
  status: StatusReserva;
  criada_em: Date;
  encerrada_em: Date | null;
}

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUNAS_RESERVA = 'id, user_id, solicitacao_id, quantidade, status, criada_em, encerrada_em';

/**
 * Adaptador do repositório sobre o esquema "creditos". Recebe a conexão da
 * transação aberta pela unidade de trabalho, então as travas valem até o COMMIT.
 */
export class PostgresRepositorioCreditos implements IRepositorioCreditos {
  constructor(private readonly db: ExecutorSql) {}

  buscarCarteira(userId: string): Promise<Carteira | null> {
    return this.carteira(userId, '');
  }

  buscarCarteiraParaAtualizar(userId: string): Promise<Carteira | null> {
    // FOR UPDATE: trava a linha da carteira. Outra transação que pedir a mesma
    // linha espera este COMMIT. É o que impede gastar o mesmo crédito duas vezes.
    return this.carteira(userId, 'FOR UPDATE');
  }

  async criarCarteiraSeNaoExistir(carteira: Carteira): Promise<boolean> {
    const r = await this.db.query(
      `INSERT INTO creditos.carteiras (user_id, disponivel, reservado) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO NOTHING`,
      [carteira.userId, carteira.disponivel, carteira.reservado],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async salvarCarteira(carteira: Carteira): Promise<void> {
    await this.db.query(
      `UPDATE creditos.carteiras SET disponivel = $2, reservado = $3, atualizado_em = NOW() WHERE user_id = $1`,
      [carteira.userId, carteira.disponivel, carteira.reservado],
    );
  }

  async buscarReservaParaAtualizar(reservaId: string): Promise<Reserva | null> {
    if (!REGEX_UUID.test(reservaId)) return null;
    const r = await this.db.query<LinhaReserva>(
      `SELECT ${COLUNAS_RESERVA} FROM creditos.reservas WHERE id = $1 FOR UPDATE`,
      [reservaId],
    );
    return r.rows[0] ? this.paraReserva(r.rows[0]) : null;
  }

  async buscarReservaPorSolicitacao(solicitacaoId: string): Promise<Reserva | null> {
    const r = await this.db.query<LinhaReserva>(
      `SELECT ${COLUNAS_RESERVA} FROM creditos.reservas WHERE solicitacao_id = $1`,
      [solicitacaoId],
    );
    return r.rows[0] ? this.paraReserva(r.rows[0]) : null;
  }

  async inserirReserva(reserva: Reserva): Promise<void> {
    await this.db.query(
      `INSERT INTO creditos.reservas (${COLUNAS_RESERVA}) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [reserva.id, reserva.userId, reserva.solicitacaoId, reserva.quantidade, reserva.status, reserva.criadaEm, reserva.encerradaEm],
    );
  }

  async salvarReserva(reserva: Reserva): Promise<void> {
    await this.db.query(`UPDATE creditos.reservas SET status = $2, encerrada_em = $3 WHERE id = $1`, [
      reserva.id,
      reserva.status,
      reserva.encerradaEm,
    ]);
  }

  private async carteira(userId: string, trava: '' | 'FOR UPDATE'): Promise<Carteira | null> {
    if (!REGEX_UUID.test(userId)) return null;
    const r = await this.db.query<LinhaCarteira>(
      `SELECT user_id, disponivel, reservado FROM creditos.carteiras WHERE user_id = $1 ${trava}`,
      [userId],
    );
    const linha = r.rows[0];
    return linha ? new Carteira(linha.user_id, linha.disponivel, linha.reservado) : null;
  }

  private paraReserva(l: LinhaReserva): Reserva {
    return new Reserva({
      id: l.id,
      userId: l.user_id,
      solicitacaoId: l.solicitacao_id,
      quantidade: l.quantidade,
      status: l.status,
      criadaEm: new Date(l.criada_em),
      encerradaEm: l.encerrada_em ? new Date(l.encerrada_em) : null,
    });
  }
}
