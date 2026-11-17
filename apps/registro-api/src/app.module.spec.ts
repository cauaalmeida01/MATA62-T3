import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

/**
 * Sobe a injeção de dependências da registro-api inteira, sem abrir porta nem
 * conectar no banco. Pega o erro "Nest can't resolve dependencies", que os testes
 * de caso de uso não pegam porque montam as classes à mão.
 */
describe('AppModule da registro-api', () => {
  it('resolve todas as dependências', async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    expect(modulo).toBeDefined();
    await modulo.close();
  });
});
