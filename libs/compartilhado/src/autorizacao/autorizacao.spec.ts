import { ExecutionContext } from '@nestjs/common';
import { AcessoNegado } from '../erros/erros-dominio';
import { assinarJwt, duracaoEmSegundos, verificarJwt } from './jwt';
import { JwtAuthGuard, RequisicaoAutenticada } from './jwt-auth.guard';
import { ITokensRevogados } from './tokens-revogados.port';

const SEGREDO = 'segredo';
const agora = Math.floor(Date.now() / 1000);
const payload = { sub: 'u1', jti: 'j1', tipo: 'COMUM' as const, iat: agora, exp: agora + 60 };

function contexto(authorization?: string): { ctx: ExecutionContext; req: RequisicaoAutenticada } {
  const req = { headers: { authorization } } as RequisicaoAutenticada;
  const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('JWT', () => {
  it('assina e verifica', () => {
    expect(verificarJwt(assinarJwt(payload, SEGREDO), SEGREDO)).toEqual(payload);
  });

  it('recusa expirado, adulterado e "alg: none"', () => {
    expect(() => verificarJwt(assinarJwt({ ...payload, exp: agora - 1 }, SEGREDO), SEGREDO)).toThrow(AcessoNegado);

    const [c, , a] = assinarJwt(payload, SEGREDO).split('.');
    const corpoTrocado = Buffer.from(JSON.stringify({ ...payload, sub: 'outro' })).toString('base64url');
    expect(() => verificarJwt(`${c}.${corpoTrocado}.${a}`, SEGREDO)).toThrow(AcessoNegado);

    const none = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    expect(() => verificarJwt(`${none}.${corpoTrocado}.`, SEGREDO)).toThrow(AcessoNegado);
  });

  it('entende a validade do .env', () => {
    expect(duracaoEmSegundos('1h')).toBe(3600);
    expect(duracaoEmSegundos('30m')).toBe(1800);
    expect(duracaoEmSegundos('90')).toBe(90);
    expect(duracaoEmSegundos('xyz', 10)).toBe(10);
  });
});

describe('JwtAuthGuard', () => {
  const revogados: ITokensRevogados & { jtis: Set<string> } = {
    jtis: new Set(),
    revogar: async (jti) => void revogados.jtis.add(jti),
    estaRevogado: async (jti) => revogados.jtis.has(jti),
  };
  const guard = new JwtAuthGuard(revogados);
  beforeAll(() => (process.env.JWT_SECRET = SEGREDO));

  it('coloca o usuário na requisição', async () => {
    const { ctx, req } = contexto(`Bearer ${assinarJwt(payload, SEGREDO)}`);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.usuario).toMatchObject({ id: 'u1', jti: 'j1', tipo: 'COMUM' });
  });

  it('recusa sem cabeçalho e com token revogado', async () => {
    await expect(guard.canActivate(contexto().ctx)).rejects.toThrow(AcessoNegado);
    await revogados.revogar('j1', new Date());
    await expect(guard.canActivate(contexto(`Bearer ${assinarJwt(payload, SEGREDO)}`).ctx)).rejects.toThrow(
      'Sessão encerrada',
    );
  });
});
