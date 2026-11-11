import { ArgumentsHost, Logger } from '@nestjs/common';
import { CreditosInsuficientes, RecursoNaoEncontrado } from './erros-dominio';
import { FiltroErrosDominio } from './filtro-erros-dominio';

function hostFalso() {
  const resposta = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = {
    switchToHttp: () => ({ getResponse: () => resposta, getRequest: () => ({ url: '/api/teste' }) }),
  } as unknown as ArgumentsHost;
  return { host, resposta };
}

describe('FiltroErrosDominio', () => {
  it('converte erro de domínio no status e no formato combinados', () => {
    const { host, resposta } = hostFalso();
    new FiltroErrosDominio().catch(new RecursoNaoEncontrado('Registro não existe'), host);

    expect(resposta.status).toHaveBeenCalledWith(404);
    expect(resposta.json).toHaveBeenCalledWith(
      expect.objectContaining({ erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Registro não existe' }, caminho: '/api/teste' }),
    );
  });

  it('créditos insuficientes viram 402', () => {
    const { host, resposta } = hostFalso();
    new FiltroErrosDominio().catch(new CreditosInsuficientes('Sem saldo'), host);
    expect(resposta.status).toHaveBeenCalledWith(402);
  });

  it('erro desconhecido vira 500 sem vazar detalhes', () => {
    const { host, resposta } = hostFalso();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    new FiltroErrosDominio().catch(new Error('detalhe interno'), host);
    expect(resposta.status).toHaveBeenCalledWith(500);
    expect(resposta.json).toHaveBeenCalledWith(expect.objectContaining({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno' } }));
  });
});
