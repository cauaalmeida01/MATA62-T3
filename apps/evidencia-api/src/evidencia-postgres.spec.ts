import { randomUUID } from 'node:crypto';
import { EvidenciaDatabaseService } from './infra/evidencia-database.service';
import { PostgresEvidenciaRepository } from './infra/postgres-evidencia.repository';
import { EvidenciaParaSalvar } from './dominio';

const describeComBanco = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeComBanco('Evidência PostgreSQL: transação, idempotência e auditoria', () => {
  let db: EvidenciaDatabaseService;
  let repo: PostgresEvidenciaRepository;
  const original = process.env.DATABASE_URL;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    db = new EvidenciaDatabaseService();
    await db.garantirSchema();
    repo = new PostgresEvidenciaRepository(db);
  });

  afterAll(async () => {
    if (db) await db.onModuleDestroy();
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  });

  it('insere tabelas relacionadas + auditoria na mesma transação; repetição não duplica', async () => {
    const solicitacaoId = randomUUID();
    const userId = randomUUID();
    const evidenciaId = randomUUID();
    const dados: EvidenciaParaSalvar = {
      metadados: {
        solicitacaoId, userId, url: 'https://example.com',
        inicio: new Date().toISOString(), fim: new Date().toISOString(),
      },
      pacote: {
        evidenciaId,
        manifestoSha256: 'a'.repeat(64),
        carimbo: { fonte: 'RELOGIO_LOCAL', horario: new Date().toISOString() },
        arquivos: [
          { nome: 'screenshot.png', tipo: 'TELA', sha256: 'b'.repeat(64), tamanhoBytes: 12,
            chave: `evidencias/${evidenciaId}/screenshot.png` },
        ],
      },
    };
    const primeira = await repo.salvar(dados);
    const segunda = await repo.salvar({ ...dados, pacote: { ...dados.pacote, evidenciaId: randomUUID() } });
    expect(segunda).toEqual(primeira);
    expect(primeira.pacote.evidenciaId).toBe(evidenciaId);
    expect(primeira.pacote.arquivos).toHaveLength(1);

    const consulta = await db.query<{ total: string }>(
      'SELECT COUNT(*)::text AS total FROM evidencia.evidencias WHERE solicitacao_id = $1',
      [solicitacaoId],
    );
    expect(consulta.rows[0].total).toBe('1');
    const auditoria = await db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM compartilhado.trilha_auditoria
       WHERE entidade_id = $1 AND acao = 'EVIDENCIA_SELADA'`,
      [evidenciaId],
    );
    expect(auditoria.rows[0].total).toBe('1');
  });
});
