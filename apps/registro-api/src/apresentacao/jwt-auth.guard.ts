import { createHmac, timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable, Optional } from '@nestjs/common';
import { Request } from 'express';
import { AcessoNegado } from '@app/compartilhado';
import { RegistroDatabaseService } from '@app/infra';

export interface PayloadJwtVeridit {
  sub: string;
  jti?: string;
  tipo?: 'ADVOGADO' | 'COMUM';
  iat?: number;
  exp?: number;
}

export interface UsuarioAutenticado {
  id: string;
  sub: string;
  jti?: string;
  tipo?: 'ADVOGADO' | 'COMUM';
}

export interface RequisicaoAutenticada extends Request {
  usuario?: UsuarioAutenticado;
}

export function verificarJwtHs256(token: string, segredo: string): PayloadJwtVeridit {
  const partes = token.split('.');
  if (partes.length !== 3) {
    throw new AcessoNegado('Token JWT com formato inválido');
  }

  const [headerB64, payloadB64, assinaturaB64] = partes;

  let header: { alg?: string; typ?: string };
  let payload: PayloadJwtVeridit;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg?: string;
      typ?: string;
    };
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as PayloadJwtVeridit;
  } catch {
    throw new AcessoNegado('Token JWT malformado');
  }

  if (header.alg !== 'HS256') {
    throw new AcessoNegado('Algoritmo do token JWT não suportado');
  }

  const assinaturaEsperada = createHmac('sha256', segredo)
    .update(`${headerB64}.${payloadB64}`)
    .digest();

  let assinaturaRecebida: Buffer;
  try {
    assinaturaRecebida = Buffer.from(assinaturaB64, 'base64url');
  } catch {
    throw new AcessoNegado('Assinatura do token JWT inválida');
  }

  if (
    assinaturaRecebida.length !== assinaturaEsperada.length ||
    !timingSafeEqual(assinaturaRecebida, assinaturaEsperada)
  ) {
    throw new AcessoNegado('Assinatura do token JWT inválida');
  }

  if (typeof payload.exp === 'number') {
    const agoraSegundos = Math.floor(Date.now() / 1000);
    if (payload.exp <= agoraSegundos) {
      throw new AcessoNegado('Token JWT expirado');
    }
  }

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new AcessoNegado('Token JWT sem identificador de usuário (sub)');
  }

  return payload;
}

export function assinarJwtHs256(
  payload: PayloadJwtVeridit,
  segredo = process.env.JWT_SECRET ?? 'troque-este-segredo',
): string {
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
    'base64url',
  );
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const assinaturaB64 = createHmac('sha256', segredo)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  return `${headerB64}.${payloadB64}.${assinaturaB64}`;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Optional() private readonly db?: RegistroDatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requisicao = context.switchToHttp().getRequest<RequisicaoAutenticada>();
    const cabecalhoAuth = requisicao.headers.authorization;

    if (!cabecalhoAuth || typeof cabecalhoAuth !== 'string') {
      throw new AcessoNegado('Cabeçalho Authorization ausente');
    }

    const [esquema, token] = cabecalhoAuth.trim().split(/\s+/);
    if (!esquema || esquema.toLowerCase() !== 'bearer' || !token) {
      throw new AcessoNegado('Formato de autorização inválido; use Bearer <token>');
    }

    const segredo = process.env.JWT_SECRET ?? 'troque-este-segredo';
    const payload = verificarJwtHs256(token, segredo);

    if (payload.jti && this.db && process.env.NODE_ENV !== 'test') {
      await this.verificarTokenRevogado(payload.jti);
    }

    requisicao.usuario = {
      id: payload.sub,
      sub: payload.sub,
      jti: payload.jti,
      tipo: payload.tipo,
    };

    return true;
  }

  private async verificarTokenRevogado(jti: string): Promise<void> {
    if (!this.db) {
      return;
    }

    let revogado = false;
    try {
      const resultado = await this.db.query<{ jti: string }>(
        `SELECT jti FROM compartilhado.tokens_revogados WHERE jti = $1 AND expira_em > NOW() LIMIT 1`,
        [jti],
      );
      revogado = (resultado.rowCount ?? 0) > 0;
    } catch (erro) {
      // Caso a tabela compartilhado.tokens_revogados ainda não tenha sido criada no banco local,
      // ignora apenas o erro de relação inexistente (42P01).
      const codigoPg = (erro as { code?: string })?.code;
      if (codigoPg !== '42P01' && codigoPg !== '3F000') {
        throw erro;
      }
    }

    if (revogado) {
      throw new AcessoNegado('Token JWT foi revogado');
    }
  }
}
