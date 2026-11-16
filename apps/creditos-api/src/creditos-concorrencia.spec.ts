import { randomUUID } from 'node:crypto';
import { Conflito, CreditosInsuficientes } from '@app/compartilhado';
import { CreditosDatabaseService } from '@app/infra';
import { CriarCarteiraUseCase, EfetivarReservaUseCase, LiberarReservaUseCase, ReservarCreditoUseCase } from './aplicacao';
import { PostgresUnidadeDeTrabalhoCreditos } from './infra';

/**
 * Teste de concorrência com PostgreSQL de verdade: é aqui que o SELECT ... FOR UPDATE
 * aparece. Precisa de TEST_DATABASE_URL (a CI sobe um PostgreSQL para isso).
 * Localmente: TEST_DATABASE_URL=postgresql://veridit:veridit@localhost:5432/veridit npm test
 */
const urlTeste = process.env.TEST_DATABASE_URL;
const descrever = urlTeste ? describe : describe.skip;

descrever('Créditos no PostgreSQL com pedidos simultâneos', () => {
  let db: CreditosDatabaseService;
  let uow: PostgresUnidadeDeTrabalhoCreditos;

  beforeAll(async () => {
    process.env.DATABASE_URL = urlTeste;
    db = new CreditosDatabaseService();
    await db.garantirSchema();
    uow = new PostgresUnidadeDeTrabalhoCreditos(db);
  });

  afterAll(async () => {
    await db.onModuleDestroy();
  });

  async function saldo(userId: string) {
    const r = await db.query<{ disponivel: number; reservado: number }>(
      'SELECT disponivel, reservado FROM creditos.carteiras WHERE user_id = $1',
      [userId],
    );
    return r.rows[0];
  }

  it('20 reservas ao mesmo tempo com 5 créditos: exatamente 5 passam', async () => {
    const userId = randomUUID();
    await new CriarCarteiraUseCase(uow, 5).executar(userId);
    const reservar = new ReservarCreditoUseCase(uow);

    const resultados = await Promise.allSettled(
      Array.from({ length: 20 }, () => reservar.executar({ userId, solicitacaoId: randomUUID(), quantidade: 1 })),
    );

    const aceitas = resultados.filter((r) => r.status === 'fulfilled');
    const recusadas = resultados.filter((r) => r.status === 'rejected');
    expect(aceitas).toHaveLength(5);
    expect(recusadas.every((r) => (r as PromiseRejectedResult).reason instanceof CreditosInsuficientes)).toBe(true);
    expect(await saldo(userId)).toEqual({ disponivel: 0, reservado: 5 });
  });

  it('efetivar e liberar a mesma reserva ao mesmo tempo: só um vence e o saldo fecha', async () => {
    const userId = randomUUID();
    await new CriarCarteiraUseCase(uow, 3).executar(userId);
    const { reservaId } = await new ReservarCreditoUseCase(uow).executar({
      userId,
      solicitacaoId: randomUUID(),
      quantidade: 1,
    });

    const efetivar = new EfetivarReservaUseCase(uow);
    const liberar = new LiberarReservaUseCase(uow);
    const resultados = await Promise.allSettled([
      efetivar.executar(reservaId),
      liberar.executar(reservaId),
      efetivar.executar(reservaId),
      liberar.executar(reservaId),
    ]);

    const conflitos = resultados.filter((r) => r.status === 'rejected');
    expect(conflitos.length).toBe(2);
    expect(conflitos.every((r) => (r as PromiseRejectedResult).reason instanceof Conflito)).toBe(true);

    const final = await saldo(userId);
    // Ou o crédito foi consumido (2 + 0), ou voltou (3 + 0). Nunca os dois, nunca nenhum.
    expect([{ disponivel: 2, reservado: 0 }, { disponivel: 3, reservado: 0 }]).toContainEqual(final);
  });
});
