import { TipoUsuario } from '../usuario.entity';

export const EMISSOR_TOKEN = Symbol('EMISSOR_TOKEN');

export interface TokenEmitido {
  token: string;
  jti: string;
  expiraEm: Date;
}

export interface IEmissorToken {
  emitir(usuario: { id: string; tipo: TipoUsuario }): TokenEmitido;
}
