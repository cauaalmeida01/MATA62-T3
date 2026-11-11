import { RegistroNaoEncontrado } from '../dominio/erros';
import { Registro } from '../dominio/registro';
import { DetalharRegistro, ListarRegistros } from './consultar-registros';
import { novoRegistro, RegistroRepositorioEmMemoria } from './testes/dubles';

describe('Consulta de registros (REQ12 e REQ13)', () => {
  let repositorio: RegistroRepositorioEmMemoria;

  beforeEach(() => {
    repositorio = new RegistroRepositorioEmMemoria();
  });

  async function salvar(extra: Parameters<typeof novoRegistro>[0], criadoEm: string) {
    return repositorio.salvar(Registro.criar(novoRegistro(extra), new Date(criadoEm)));
  }

  it('lista só os registros do usuário, mais novos primeiro', async () => {
    const antigo = await salvar({ solicitacaoId: 's1' }, '2026-11-10T10:00:00Z');
    const novo = await salvar({ solicitacaoId: 's2' }, '2026-11-11T10:00:00Z');
    await salvar({ solicitacaoId: 's3', userId: 'user-2' }, '2026-11-11T11:00:00Z');

    const lista = await new ListarRegistros(repositorio).executar('user-1');

    expect(lista.map((r) => r.id)).toEqual([novo.id, antigo.id]);
  });

  it('mostra os detalhes do próprio registro', async () => {
    const registro = await salvar({}, '2026-11-11T10:00:00Z');

    const detalhe = await new DetalharRegistro(repositorio).executar(registro.id, 'user-1');

    expect(detalhe.carimbo.fonte).toBe('FREETSA');
    expect(detalhe.arquivos).toHaveLength(1);
  });

  it('registro de outro usuário responde como inexistente', async () => {
    const registro = await salvar({}, '2026-11-11T10:00:00Z');

    await expect(new DetalharRegistro(repositorio).executar(registro.id, 'user-2')).rejects.toBeInstanceOf(
      RegistroNaoEncontrado,
    );
  });

  it('id inexistente responde como inexistente', async () => {
    await expect(new DetalharRegistro(repositorio).executar('nao-existe', 'user-1')).rejects.toBeInstanceOf(
      RegistroNaoEncontrado,
    );
  });
});
