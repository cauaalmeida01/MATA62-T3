import { Injectable } from '@nestjs/common';
import { RegistroDatabaseService } from '@app/infra';
import {
  ISolicitacaoWorkerRepository,
  ModoCaptura,
  SolicitacaoWorker,
  StatusSolicitacao,
} from '../dominio';

interface LinhaSolicitacaoWorker {
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
export class PostgresSolicitacaoWorkerRepository implements ISolicitacaoWorkerRepository {
  constructor(private readonly db: RegistroDatabaseService) {}

  async buscarPorId(id: string): Promise<SolicitacaoWorker | null> {
    if (!REGEX_UUID.test(id)) {
      return null;
    }

    const resultado = await this.db.query<LinhaSolicitacaoWorker>(
      `SELECT id, user_id, url, titulo, modo, status, reserva_id, ultimo_erro, criada_em, atualizada_em
         FROM registro.solicitacoes
        WHERE id = $1`,
      [id],
    );

    if (resultado.rowCount === 0) {
      return null;
    }

    return this.mapearLinha(resultado.rows[0]);
  }

  async marcarProcessando(id: string): Promise<void> {
    await this.db.query(
      `UPDATE registro.solicitacoes
          SET status = 'PROCESSANDO',
              atualizada_em = NOW()
        WHERE id = $1
          AND status <> 'CONCLUIDA'`,
      [id],
    );
  }

  async marcarConcluida(id: string): Promise<void> {
    await this.db.query(
      `UPDATE registro.solicitacoes
          SET status = 'CONCLUIDA',
              ultimo_erro = NULL,
              atualizada_em = NOW()
        WHERE id = $1`,
      [id],
    );
  }

  async marcarFalhou(id: string, motivo: string): Promise<void> {
    await this.db.query(
      `UPDATE registro.solicitacoes
          SET status = 'FALHOU',
              ultimo_erro = $2,
              atualizada_em = NOW()
        WHERE id = $1
          AND status <> 'CONCLUIDA'`,
      [id, motivo],
    );
  }

  async registrarTentativaComErro(id: string, motivo: string): Promise<void> {
    await this.db.query(
      `UPDATE registro.solicitacoes
          SET ultimo_erro = $2,
              atualizada_em = NOW()
        WHERE id = $1
          AND status <> 'CONCLUIDA'`,
      [id, motivo],
    );
  }

  async listarPendentesOuProcessandoTravadas(minutos: number): Promise<SolicitacaoWorker[]> {
    const resultado = await this.db.query<LinhaSolicitacaoWorker>(
      `SELECT id, user_id, url, titulo, modo, status, reserva_id, ultimo_erro, criada_em, atualizada_em
         FROM registro.solicitacoes
        WHERE status IN ('PENDENTE', 'PROCESSANDO')
          AND atualizada_em < NOW() - ($1 * INTERVAL '1 minute')
        ORDER BY criada_em ASC`,
      [minutos],
    );

    return resultado.rows.map((linha) => this.mapearLinha(linha));
  }

  private mapearLinha(linha: LinhaSolicitacaoWorker): SolicitacaoWorker {
    return {
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
    };
  }
}
