import { createHmac, timingSafeEqual } from 'node:crypto';
import { AcessoNegado } from '../erros/erros-dominio';

/** Campos do token JWT do Veridit (docs/contratos.md, seção 5). */
export interface PayloadJwt {
  sub: string;
  jti: string;
  tipo: 'ADVOGADO' | 'COMUM';
  iat: number;
  exp: number;
}

function assinatura(conteudo: string, segredo: string): Buffer {
  return createHmac('sha256', segredo).update(conteudo).digest();
}

/** Monta um JWT HS256: cabeçalho.payload.assinatura, cada parte em base64url. */
export function assinarJwt(payload: PayloadJwt, segredo: string): string {
  const cabecalho = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const corpo = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${cabecalho}.${corpo}.${assinatura(`${cabecalho}.${corpo}`, segredo).toString('base64url')}`;
}

/**
 * Confere a assinatura e a validade do token e devolve o payload.
 * Qualquer problema vira AcessoNegado (erro de domínio), nunca erro HTTP.
 */
export function verificarJwt(token: string, segredo: string, agora = new Date()): PayloadJwt {
  const partes = token.split('.');
  if (partes.length !== 3) {
    throw new AcessoNegado('Token com formato inválido');
  }
  const [cabecalhoB64, corpoB64, assinaturaB64] = partes;

  let cabecalho: { alg?: string };
  let payload: Partial<PayloadJwt>;
  try {
    cabecalho = JSON.parse(Buffer.from(cabecalhoB64, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(corpoB64, 'base64url').toString('utf8'));
  } catch {
    throw new AcessoNegado('Token malformado');
  }

  // Só aceitamos HS256: impede o truque de mandar "alg: none" para pular a assinatura.
  if (cabecalho.alg !== 'HS256') {
    throw new AcessoNegado('Algoritmo do token não suportado');
  }

  const esperada = assinatura(`${cabecalhoB64}.${corpoB64}`, segredo);
  const recebida = Buffer.from(assinaturaB64, 'base64url');
  // timingSafeEqual compara em tempo constante, para não vazar a assinatura pelo tempo de resposta.
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) {
    throw new AcessoNegado('Assinatura do token inválida');
  }

  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= agora.getTime()) {
    throw new AcessoNegado('Token expirado');
  }
  if (typeof payload.sub !== 'string' || typeof payload.jti !== 'string') {
    throw new AcessoNegado('Token sem usuário (sub) ou sem identificador (jti)');
  }

  return payload as PayloadJwt;
}

/** Converte JWT_EXPIRA_EM ("1h", "30m", "45s", "2d" ou segundos) em segundos. */
export function duracaoEmSegundos(texto: string | undefined, padrao = 3600): number {
  if (!texto) return padrao;
  const m = /^(\d+)\s*([smhd]?)$/.exec(texto.trim());
  if (!m) return padrao;
  const fator = { '': 1, s: 1, m: 60, h: 3600, d: 86400 }[m[2] as '' | 's' | 'm' | 'h' | 'd'];
  return Number(m[1]) * fator;
}

export function segredoJwt(): string {
  return process.env.JWT_SECRET ?? 'troque-este-segredo';
}
