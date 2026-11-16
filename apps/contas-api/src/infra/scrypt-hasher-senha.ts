import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { IHasherSenha } from '../dominio';

const scryptAsync = promisify(scrypt) as (senha: string, sal: Buffer, tamanho: number) => Promise<Buffer>;
const TAMANHO_HASH = 64;

/**
 * Hash de senha com scrypt (nativo do Node, sem biblioteca extra). O scrypt é lento
 * de propósito e usa um "sal" aleatório por usuário: duas senhas iguais geram hashes
 * diferentes e um vazamento do banco não revela as senhas.
 * Formato guardado: scrypt$<sal em hex>$<hash em hex>
 */
export class ScryptHasherSenha implements IHasherSenha {
  async gerarHash(senha: string): Promise<string> {
    const sal = randomBytes(16);
    const hash = await scryptAsync(senha, sal, TAMANHO_HASH);
    return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`;
  }

  async conferir(senha: string, guardado: string): Promise<boolean> {
    const [algoritmo, salHex, hashHex] = guardado.split('$');
    if (algoritmo !== 'scrypt' || !salHex || !hashHex) return false;
    const esperado = Buffer.from(hashHex, 'hex');
    const calculado = await scryptAsync(senha, Buffer.from(salHex, 'hex'), esperado.length);
    return timingSafeEqual(calculado, esperado);
  }
}
