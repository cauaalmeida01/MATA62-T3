import { Conflito, CreditosInsuficientes, RecursoNaoEncontrado, RegraDeNegocioViolada } from '@app/compartilhado';
import {
  ConsultarSaldoUseCase,
  CriarCarteiraUseCase,
  EfetivarReservaUseCase,
  LiberarReservaUseCase,
  ReservarCreditoUseCase,
} from './aplicacao';
import { Carteira, IRepositorioCreditos, IUnidadeDeTrabalhoCreditos, Reserva } from './dominio';

/**
 * Unidade de trabalho em memória: trabalha numa cópia e só "comita" se não houver erro.
 * Assim os testes também conferem o tudo ou nada (rollback), sem PostgreSQL.
 */
class UnidadeDeTrabalhoEmMemoria implements IUnidadeDeTrabalhoCreditos {
  carteiras = new Map<string, { disponivel: number; reservado: number }>();
  reservas = new Map<string, Reserva>();

  async executar<T>(trabalho: (repo: IRepositorioCreditos) => Promise<T>): Promise<T> {
    const carteiras = new Map([...this.carteiras].map(([k, v]) => [k, { ...v }]));
    const reservas = new Map([...this.reservas].map(([k, r]) => [k, new Reserva({ ...r, status: r.status, encerradaEm: r.encerradaEm })]));
    const repo: IRepositorioCreditos = {
      buscarCarteira: async (id) => (carteiras.has(id) ? new Carteira(id, carteiras.get(id)!.disponivel, carteiras.get(id)!.reservado) : null),
      buscarCarteiraParaAtualizar: async (id) => repo.buscarCarteira(id),
      criarCarteiraSeNaoExistir: async (c) => {
        if (carteiras.has(c.userId)) return false;
        carteiras.set(c.userId, { disponivel: c.disponivel, reservado: c.reservado });
        return true;
      },
      salvarCarteira: async (c) => void carteiras.set(c.userId, { disponivel: c.disponivel, reservado: c.reservado }),
      buscarReservaParaAtualizar: async (id) => reservas.get(id) ?? null,
      buscarReservaPorSolicitacao: async (s) => [...reservas.values()].find((r) => r.solicitacaoId === s) ?? null,
      inserirReserva: async (r) => void reservas.set(r.id, r),
      salvarReserva: async (r) => void reservas.set(r.id, r),
    };
    const resultado = await trabalho(repo);
    this.carteiras = carteiras;
    this.reservas = reservas;
    return resultado;
  }
}

const USUARIO = '11111111-1111-4111-8111-111111111111';
const solicitacao = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;

function montar(creditosIniciais = 2) {
  const uow = new UnidadeDeTrabalhoEmMemoria();
  return {
    uow,
    criar: new CriarCarteiraUseCase(uow, creditosIniciais),
    saldo: new ConsultarSaldoUseCase(uow),
    reservar: new ReservarCreditoUseCase(uow),
    efetivar: new EfetivarReservaUseCase(uow),
    liberar: new LiberarReservaUseCase(uow),
  };
}

describe('Carteira (entidade)', () => {
  it('reserva, efetiva e libera mexendo nos dois saldos', () => {
    const c = Carteira.nova(USUARIO, 3);
    c.reservar(2);
    expect([c.disponivel, c.reservado]).toEqual([1, 2]);
    c.efetivar(1);
    expect([c.disponivel, c.reservado]).toEqual([1, 1]);
    c.liberar(1);
    expect([c.disponivel, c.reservado]).toEqual([2, 0]);
  });

  it('recusa reservar sem saldo e quantidades inválidas', () => {
    const c = Carteira.nova(USUARIO, 1);
    expect(() => c.reservar(2)).toThrow(CreditosInsuficientes);
    expect(() => c.reservar(0)).toThrow(RegraDeNegocioViolada);
    expect(() => c.reservar(1.5)).toThrow(RegraDeNegocioViolada);
    expect(() => c.efetivar(1)).toThrow(RegraDeNegocioViolada); // nada reservado
  });
});

describe('Reserva (entidade)', () => {
  const nova = () => Reserva.nova({ id: 'r1', userId: USUARIO, solicitacaoId: solicitacao(1), quantidade: 1 });

  it('efetivar duas vezes é idempotente; liberar depois é conflito', () => {
    const r = nova();
    expect(r.efetivar()).toBe(true);
    expect(r.efetivar()).toBe(false);
    expect(r.status).toBe('EFETIVADA');
    expect(() => r.liberar()).toThrow(Conflito);
  });

  it('liberar duas vezes é idempotente; efetivar depois é conflito', () => {
    const r = nova();
    expect(r.liberar()).toBe(true);
    expect(r.liberar()).toBe(false);
    expect(() => r.efetivar()).toThrow(Conflito);
  });
});

describe('Casos de uso de créditos', () => {
  it('cria a carteira com os créditos iniciais uma única vez', async () => {
    const { criar, saldo } = montar(5);
    await expect(criar.executar(USUARIO)).resolves.toEqual({ criada: true, disponivel: 5, reservado: 0 });
    await expect(criar.executar(USUARIO)).resolves.toEqual({ criada: false, disponivel: 5, reservado: 0 });
    await expect(saldo.executar(USUARIO)).resolves.toEqual({ disponivel: 5, reservado: 0 });
  });

  it('reserva 1 crédito e devolve a mesma reserva se a solicitação se repetir', async () => {
    const { criar, saldo, reservar } = montar(2);
    await criar.executar(USUARIO);
    const a = await reservar.executar({ userId: USUARIO, solicitacaoId: solicitacao(1), quantidade: 1 });
    const b = await reservar.executar({ userId: USUARIO, solicitacaoId: solicitacao(1), quantidade: 1 });
    expect(b.reservaId).toBe(a.reservaId);
    await expect(saldo.executar(USUARIO)).resolves.toEqual({ disponivel: 1, reservado: 1 });
  });

  it('recusa reservar sem saldo (402) e não grava nada', async () => {
    const { uow, criar, reservar } = montar(1);
    await criar.executar(USUARIO);
    await reservar.executar({ userId: USUARIO, solicitacaoId: solicitacao(1), quantidade: 1 });
    await expect(reservar.executar({ userId: USUARIO, solicitacaoId: solicitacao(2), quantidade: 1 })).rejects.toThrow(
      CreditosInsuficientes,
    );
    expect(uow.reservas.size).toBe(1);
  });

  it('recusa reservar para usuário sem carteira', async () => {
    const { reservar } = montar();
    await expect(reservar.executar({ userId: USUARIO, solicitacaoId: solicitacao(1), quantidade: 1 })).rejects.toThrow(
      RecursoNaoEncontrado,
    );
  });

  it('efetivar consome o reservado; repetir não desconta de novo', async () => {
    const { criar, saldo, reservar, efetivar } = montar(2);
    await criar.executar(USUARIO);
    const { reservaId } = await reservar.executar({ userId: USUARIO, solicitacaoId: solicitacao(1), quantidade: 1 });
    await expect(efetivar.executar(reservaId)).resolves.toEqual({ reservaId, status: 'EFETIVADA' });
    await expect(efetivar.executar(reservaId)).resolves.toEqual({ reservaId, status: 'EFETIVADA' });
    await expect(saldo.executar(USUARIO)).resolves.toEqual({ disponivel: 1, reservado: 0 });
  });

  it('liberar devolve o crédito; repetir não devolve de novo', async () => {
    const { criar, saldo, reservar, liberar } = montar(2);
    await criar.executar(USUARIO);
    const { reservaId } = await reservar.executar({ userId: USUARIO, solicitacaoId: solicitacao(1), quantidade: 1 });
    await liberar.executar(reservaId);
    await liberar.executar(reservaId);
    await expect(saldo.executar(USUARIO)).resolves.toEqual({ disponivel: 2, reservado: 0 });
  });

  it('não deixa liberar o que já foi efetivado, e o saldo não muda', async () => {
    const { criar, saldo, reservar, efetivar, liberar } = montar(2);
    await criar.executar(USUARIO);
    const { reservaId } = await reservar.executar({ userId: USUARIO, solicitacaoId: solicitacao(1), quantidade: 1 });
    await efetivar.executar(reservaId);
    await expect(liberar.executar(reservaId)).rejects.toThrow(Conflito);
    await expect(saldo.executar(USUARIO)).resolves.toEqual({ disponivel: 1, reservado: 0 });
  });

  it('reserva inexistente é 404', async () => {
    const { efetivar, liberar } = montar();
    await expect(efetivar.executar('nao-existe')).rejects.toThrow(RecursoNaoEncontrado);
    await expect(liberar.executar('nao-existe')).rejects.toThrow(RecursoNaoEncontrado);
  });
});
