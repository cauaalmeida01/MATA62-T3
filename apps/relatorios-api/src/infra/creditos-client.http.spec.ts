import { RecursoNaoEncontrado } from '@app/compartilhado';
import { ReservaJaLiberada } from '../dominio/erros';
import { CreditosClientHttp } from './creditos-client.http';

describe('CreditosClientHttp', () => {
  const client = new CreditosClientHttp('http://creditos-api:3000/api');
  let fetchFalso: jest.SpyInstance;

  beforeEach(() => {
    fetchFalso = jest.spyOn(global, 'fetch');
  });
  afterEach(() => fetchFalso.mockRestore());

  const responde = (status: number) => fetchFalso.mockResolvedValue(new Response(null, { status }));

  it('chama a rota interna de efetivar', async () => {
    responde(200);
    await client.efetivar('res-1');
    expect(fetchFalso).toHaveBeenCalledWith(
      'http://creditos-api:3000/api/internal/reservas/res-1/efetivar',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('409 vira ReservaJaLiberada', async () => {
    responde(409);
    await expect(client.efetivar('res-1')).rejects.toBeInstanceOf(ReservaJaLiberada);
  });

  it('404 vira RecursoNaoEncontrado', async () => {
    responde(404);
    await expect(client.efetivar('res-1')).rejects.toBeInstanceOf(RecursoNaoEncontrado);
  });

  it('500 sobe como erro técnico', async () => {
    responde(500);
    await expect(client.efetivar('res-1')).rejects.toThrow('creditos-api respondeu 500');
  });
});
