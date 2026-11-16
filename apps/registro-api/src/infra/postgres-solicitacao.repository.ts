import { Injectable } from '@nestjs/common';
import { RegistroDatabaseService } from '@app/infra';
import {
  ISolicitacaoRepository,
  ModoCaptura,
  SolicitacaoRegistro,
  StatusSolicitacao,
} from '../dominio';

interface LinhaSolicitacao {
  id: string;
  user_id: string;
  url: string;
  titulo: string;
  modo: ModoCaptura;
  status: StatusSolicitacao;
  reserva_id: string;
  ultimo_erro: string | null;
  criada_em: Date | string;
  atualizada_em: Date | string;
}

const REGEX_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class PostgresSolicitacaoRepository implements ISolicitacaoRepository {
  constructor(private readonly db: RegistroDatabaseService) {}

  async criar(solicitacao: SolicitacaoRegistro): Promise<void> {
    await this.db.query(
      `INSERT INTO registro.solicitacoes (
        id, user_id, url, titulo, modo, status, reserva_id, ultimo_erro, criada_em, atualizada_em
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        solicitacao.id,
        solicitacao.userId,
        solicitacao.url,
        solicitacao.titulo,
        solicitacao.modo,
        solicitacao.status,
        solicitacao.reservaId,
        solicitacao.ultimoErro,
        solicitacao.criadaEm,
        solicitacao.atualizadaEm,
      ],
    );
  }

  async buscarPorId(id: string): Promise<SolicitacaoRegistro | null> {
    if (!REGEX_UUID.test(id)) {
      return null;
    }

    const resultado = await this.db.query<LinhaSolicitacao>(
      `SELECT id, user_id, url, titulo, modo, status, reserva_id, ultimo_erro, criada_em, atualizada_em
         FROM registro.solicitacoes
        WHERE id = $1`,
      [id],
    );

    if (resultado.rowCount === 0) {
      return null;
    }

    return this.paraEntidade(resultado.rows[0]);
  }

  async atualizarStatus(
    id: string,
    status: StatusSolicitacao,
    ultimoErro: string | null = null,
  ): Promise<void> {
    await this.db.query(
      `UPDATE registro.solicitacoes
          SET status = $2,
              ultimo_erro = $3,
              atualizada_em = NOW()
        WHERE id = $1`,
      [id, status, ultimoErro],
    );
  }

  async listarPendentesTravadas(minutos: number): Promise<SolicitacaoRegistro[]> {
    const resultado = await this.db.query<LinhaSolicitacao>(
      `SELECT id, user_id, url, titulo, modo, status, reserva_id, ultimo_erro, criada_em, atualizada_em
         FROM registro.solicitacoes
        WHERE status IN ('PENDENTE', 'PROCESSANDO')
          AND atualizada_em < NOW() - ($1 * INTERVAL '1 minute')
        ORDER BY criada_em ASC`,
      [minutos],
    );

    return resultado.rows.map((linha) => this.paraEntidade(linha));
  }

  private paraEntidade(linha: LinhaSolicitacao): SolicitacaoRegistro {
    return new SolicitacaoRegistro({
      id: linha.id,
      userId: linha.user_id,
      url: linha.url,
      titulo: linha.titulo,
      modo: linha.modo,
      status: linha.status,
      reservaId: linha.reserva_id,
      ultimoErro: linha.ultimo_erro,
      criadaEm: new Date(linha.criada_em),
      atualizadaEm: new Date(linha.atualizada_em),
    });
  }
}
