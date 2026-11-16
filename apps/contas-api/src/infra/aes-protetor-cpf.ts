import { createCipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { Cpf, IProtetorCpf } from '../dominio';

/**
 * Protege o CPF com uma chave em variável de ambiente (CPF_CHAVE_CIFRAGEM), no lugar
 * do AWS KMS do T2 (desvio pendente, ADR-007).
 *  - cifrar: AES-256-GCM, com vetor aleatório (o mesmo CPF cifrado duas vezes dá textos diferentes).
 *    Formato: <iv>.<tag>.<texto cifrado>, em base64url.
 *  - hashParaBusca: HMAC-SHA256 com a chave. Um SHA-256 simples não serviria: só existem
 *    10^11 CPFs, e daria para testar todos. Sem a chave, não dá.
 */
export class AesProtetorCpf implements IProtetorCpf {
  private readonly chaveCifragem: Buffer;
  private readonly chaveHash: Buffer;

  constructor(segredo = process.env.CPF_CHAVE_CIFRAGEM ?? 'troque-esta-chave') {
    // Duas chaves derivadas do mesmo segredo, uma para cada uso.
    this.chaveCifragem = createHash('sha256').update(`cifragem:${segredo}`).digest();
    this.chaveHash = createHash('sha256').update(`busca:${segredo}`).digest();
  }

  cifrar(cpf: Cpf): string {
    const iv = randomBytes(12);
    const cifra = createCipheriv('aes-256-gcm', this.chaveCifragem, iv);
    const texto = Buffer.concat([cifra.update(cpf.digitos, 'utf8'), cifra.final()]);
    return [iv, cifra.getAuthTag(), texto].map((b) => b.toString('base64url')).join('.');
  }

  hashParaBusca(cpf: Cpf): string {
    return createHmac('sha256', this.chaveHash).update(cpf.digitos).digest('hex');
  }
}
