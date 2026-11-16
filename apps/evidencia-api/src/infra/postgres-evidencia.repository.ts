import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Conflito } from '@app/compartilhado';
import { TrilhaAuditoriaRepository } from '@app/infra/auditoria/trilha-auditoria.repository';
import { EvidenciaParaSalvar, EvidenciaPersistida, IEvidenciaRepository, ArquivoSelado } from '../dominio';
import { EvidenciaDatabaseService } from './evidencia-database.service';

interface LinhaEvidencia {
  id: string;
  user_id: string;
  manifesto_sha256: string;
  carimbo_fonte: 'FREETSA' | 'RELOGIO_LOCAL';
  carimbo_horario: Date | string;
  carimbo_token: string | null;
}
interface LinhaArquivo {
  nome: string;
  tipo: ArquivoSelado['tipo'];
  sha256: string;
  tamanho_bytes: string;
  chave: string;
}

@Injectable()
export class PostgresEvidenciaRepository implements IEvidenciaRepository {
  private readonly auditoria = new TrilhaAuditoriaRepository();

  constructor(private readonly db: EvidenciaDatabaseService) {}

  async buscarPorSolicitacao(solicitacaoId: string): Promise<EvidenciaPersistida | null> {
    const resultado = await this.db.query<LinhaEvidencia>(
      `SELECT id, user_id, manifesto_sha256, carimbo_fonte, carimbo_horario, carimbo_token
       FROM evidencia.evidencias WHERE solicitacao_id = $1`,
      [solicitacaoId],
    );
    if (!resultado.rows.length) return null;
    const registro = resultado.rows[0];
    const arquivos = await this.db.query<LinhaArquivo>(
      `SELECT nome, tipo, sha256, tamanho_bytes, chave FROM evidencia.arquivos
       WHERE evidencia_id = $1 ORDER BY nome ASC`,
      [registro.id],
    );
    return {
      userId: registro.user_id,
      pacote: {
        evidenciaId: registro.id,
        manifestoSha256: registro.manifesto_sha256.trim(),
        carimbo: {
          fonte: registro.carimbo_fonte,
          horario: new Date(registro.carimbo_horario).toISOString(),
          ...(registro.carimbo_token ? { tokenBase64: registro.carimbo_token } : {}),
        },
        arquivos: arquivos.rows.map((arquivo) => ({
          nome: arquivo.nome,
          tipo: arquivo.tipo,
          sha256: arquivo.sha256.trim(),
          tamanhoBytes: Number(arquivo.tamanho_bytes),
          chave: arquivo.chave,
        })),
      },
    };
  }

  async salvar({ metadados, pacote }: EvidenciaParaSalvar): Promise<EvidenciaPersistida> {
    const inseriu = await this.db.transacao(async (executor) => {
      const registro = await executor.query<{ id: string }>(
        `INSERT INTO evidencia.evidencias
         (id, solicitacao_id, user_id, manifesto_sha256, carimbo_fonte, carimbo_horario, carimbo_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (solicitacao_id) DO NOTHING RETURNING id`,
        [pacote.evidenciaId, metadados.solicitacaoId, metadados.userId,
          pacote.manifestoSha256, pacote.carimbo.fonte, pacote.carimbo.horario,
          pacote.carimbo.tokenBase64 ?? null],
      );
      if (!registro.rows.length) return false;
      for (const arquivo of pacote.arquivos) {
        await executor.query(
          `INSERT INTO evidencia.arquivos
           (id, evidencia_id, nome, tipo, sha256, tamanho_bytes, chave)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [randomUUID(), pacote.evidenciaId, arquivo.nome, arquivo.tipo,
            arquivo.sha256, arquivo.tamanhoBytes, arquivo.chave],
        );
      }
      await this.auditoria.registrar(executor, {
        userId: metadados.userId,
        acao: 'EVIDENCIA_SELADA',
        entidadeId: pacote.evidenciaId,
        dados: {
          solicitacaoId: metadados.solicitacaoId,
          manifestoSha256: pacote.manifestoSha256,
          fonteCarimbo: pacote.carimbo.fonte,
          totalArquivos: pacote.arquivos.length,
        },
      });
      return true;
    });
    // Corridas entre workers: o primeiro vence, e todos recebem o MESMO pacote.
    const persistida = await this.buscarPorSolicitacao(metadados.solicitacaoId);
    if (!persistida) throw new Error('Evidência não encontrada após persistência');
    if (persistida.userId !== metadados.userId) throw new Conflito('Solicitação pertence a outro usuário');
    if (!inseriu && persistida.pacote.manifestoSha256 !== pacote.manifestoSha256) {
      // Reprocessamentos podem capturar conteúdo diferente: a primeira evidência é definitiva.
      return persistida;
    }
    return persistida;
  }
}
