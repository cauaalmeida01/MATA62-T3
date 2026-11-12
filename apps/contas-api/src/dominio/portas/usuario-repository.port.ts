import { Usuario } from '../usuario.entity';

export const USUARIO_REPOSITORY = Symbol('USUARIO_REPOSITORY');

export interface IUsuarioRepository {
  existeEmail(email: string): Promise<boolean>;
  existeCpfHash(cpfHash: string): Promise<boolean>;
  /** Lança Conflito se o e-mail ou o CPF já existirem (inclusive em corrida). */
  criar(usuario: Usuario): Promise<void>;
  buscarPorEmail(email: string): Promise<Usuario | null>;
}
