import { randomUUID } from 'node:crypto';
import { assinarJwt, duracaoEmSegundos, segredoJwt } from '@app/compartilhado';
import { IEmissorToken, TipoUsuario, TokenEmitido } from '../dominio';

/** JWT próprio no lugar do Amazon Cognito (desvio pendente, ADR-007). */
export class JwtEmissorToken implements IEmissorToken {
  constructor(
    private readonly segredo = segredoJwt(),
    private readonly validadeSegundos = duracaoEmSegundos(process.env.JWT_EXPIRA_EM),
  ) {}

  emitir(usuario: { id: string; tipo: TipoUsuario }, agora = new Date()): TokenEmitido {
    const iat = Math.floor(agora.getTime() / 1000);
    const exp = iat + this.validadeSegundos;
    const jti = randomUUID(); // "número do crachá": é ele que o logout revoga
    const token = assinarJwt({ sub: usuario.id, jti, tipo: usuario.tipo, iat, exp }, this.segredo);
    return { token, jti, expiraEm: new Date(exp * 1000) };
  }
}
