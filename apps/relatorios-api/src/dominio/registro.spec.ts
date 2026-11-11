import { RegraDeNegocioViolada } from '@app/compartilhado';
import { novoRegistro } from '../aplicacao/testes/dubles';
import { Registro } from './registro';

describe('Registro', () => {
  it('cria com id e data de criação', () => {
    const registro = Registro.criar(novoRegistro(), new Date('2026-11-12T13:02:00Z'));
    expect(registro.id).toEqual(expect.any(String));
    expect(registro.paraDados().criadoEm.toISOString()).toBe('2026-11-12T13:02:00.000Z');
  });

  it('sinaliza quando o carimbo veio do relógio local', () => {
    const registro = Registro.criar(novoRegistro({ carimbo: { fonte: 'RELOGIO_LOCAL', horario: new Date() } }));
    expect(registro.carimboDeReserva).toBe(true);
  });

  it.each([
    ['sem arquivos', { arquivos: [] }],
    ['hash do manifesto inválido', { manifestoSha256: 'xyz' }],
    ['fonte de carimbo desconhecida', { carimbo: { fonte: 'OUTRA' as never, horario: new Date() } }],
    ['fim antes do início', { inicio: new Date('2026-11-12T14:00:00Z'), fim: new Date('2026-11-12T13:00:00Z') }],
    ['URL vazia', { url: ' ' }],
  ])('recusa registro %s', (_, extra) => {
    expect(() => Registro.criar(novoRegistro(extra))).toThrow(RegraDeNegocioViolada);
  });

  it('paraDados devolve cópia: mudar o retorno não muda a entidade', () => {
    const registro = Registro.criar(novoRegistro());
    registro.paraDados().arquivos[0].nome = 'alterado';
    expect(registro.paraDados().arquivos[0].nome).toBe('tela-1.png');
  });
});
