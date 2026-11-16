/** Transforma a senha num hash que não pode ser desfeito, e confere uma senha contra ele. */
export const HASHER_SENHA = Symbol('HASHER_SENHA');

export interface IHasherSenha {
  gerarHash(senha: string): Promise<string>;
  conferir(senha: string, hash: string): Promise<boolean>;
}
