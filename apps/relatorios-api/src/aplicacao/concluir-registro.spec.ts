import { RegraDeNegocioViolada } from '@app/compartilhado';
import { ConclusaoDivergente, ReservaJaLiberada } from '../dominio/erros';
import { Registro } from '../dominio/registro';
import { ConcluirRegistro } from './concluir-registro';
import { CreditosClientFalso, novoRegistro, RegistroRepositorioEmMemoria } from './testes/dubles';

describe('ConcluirRegistro (REQ11)', () => {
  let repositorio: RegistroRepositorioEmMemoria;
  let creditos: CreditosClientFalso;
  let concluir: ConcluirRegistro;

  beforeEach(() => {
    repositorio = new RegistroRepositorioEmMemoria();
    creditos = new CreditosClientFalso();
    concluir = new ConcluirRegistro(repositorio, creditos);
  });

  it('efetiva o crédito e grava o registro', async () => {
    const resultado = await concluir.executar(novoRegistro());

    expect(resultado.criado).toBe(true);
    expect(creditos.efetivadas).toEqual(['res-1']);
    expect(await repositorio.buscarPorId(resultado.registroId)).not.toBeNull();
  });

  it('chamada repetida devolve o mesmo registro sem efetivar de novo', async () => {
    const primeira = await concluir.executar(novoRegistro());
    const segunda = await concluir.executar(novoRegistro());

    expect(segunda).toEqual({ registroId: primeira.registroId, criado: false });
    expect(creditos.efetivadas).toHaveLength(1);
    expect(repositorio.itens.size).toBe(1);
  });

  it('não grava o registro se a reserva já foi liberada', async () => {
    creditos.erro = new ReservaJaLiberada('res-1');

    await expect(concluir.executar(novoRegistro())).rejects.toBeInstanceOf(ReservaJaLiberada);
    expect(repositorio.itens.size).toBe(0);
  });

  it('não grava o registro se a creditos-api estiver fora (o worker tenta de novo)', async () => {
    creditos.erro = new Error('ECONNREFUSED');

    await expect(concluir.executar(novoRegistro())).rejects.toThrow('ECONNREFUSED');
    expect(repositorio.itens.size).toBe(0);
  });

  it('dado inválido não consome crédito', async () => {
    const invalido = novoRegistro({ inicio: new Date('2026-11-12T14:00:00Z'), fim: new Date('2026-11-12T13:00:00Z') });

    await expect(concluir.executar(invalido)).rejects.toBeInstanceOf(RegraDeNegocioViolada);
    expect(creditos.efetivadas).toHaveLength(0);
  });

  it('repetida com outro usuário é conflito', async () => {
    await concluir.executar(novoRegistro());

    await expect(concluir.executar(novoRegistro({ userId: 'user-2' }))).rejects.toBeInstanceOf(ConclusaoDivergente);
  });

  it('corrida: se outra chamada gravou primeiro, devolve o registro dela', async () => {
    const outro = Registro.criar(novoRegistro());
    // A busca inicial não encontra nada, mas no salvar o outro já está lá.
    jest.spyOn(repositorio, 'buscarPorSolicitacao').mockResolvedValueOnce(null);
    repositorio.itens.set(outro.id, outro);

    const resultado = await concluir.executar(novoRegistro());

    expect(resultado).toEqual({ registroId: outro.id, criado: false });
  });
});
