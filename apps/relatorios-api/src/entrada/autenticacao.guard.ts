import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Request } from 'express';

/**
 * PROVISÓRIO: a validação do JWT é da biblioteca compartilhada (papel E, docs/contratos.md seção 5).
 * Enquanto ela não existe, este guard valida o token HS256 emitido pela contas-api.
 * Quando a biblioteca entrar, troque este guard pelo dela no RegistrosController;
 * ela também consulta compartilhado.tokens_revogados (logout), o que este NÃO faz.
 */

export const JWT_SECRET = Symbol('JWT_SECRET');

export interface UsuarioAutenticado {
  id: string;
  tipo: string;
}

type RequisicaoAutenticada = Request & { usuario?: UsuarioAutenticado };

@Injectable()
export class AutenticacaoGuard implements CanActivate {
  constructor(@Inject(JWT_SECRET) private readonly segredo: string) {}

  canActivate(contexto: ExecutionContext): boolean {
    const requisicao = contexto.switchToHttp().getRequest<RequisicaoAutenticada>();
    const [esquema, token] = (requisicao.headers.authorization ?? '').split(' ');
    if (esquema !== 'Bearer' || !token) throw new UnauthorizedException('Token ausente');

    const payload = verificarJwtHs256(token, this.segredo);
    if (!payload || typeof payload.sub !== 'string') throw new UnauthorizedException('Token inválido ou expirado');

    requisicao.usuario = { id: payload.sub, tipo: String(payload.tipo ?? '') };
    return true;
  }
}

/** Injeta o usuário do token no parâmetro do controller: `@Usuario() usuario`. */
export const Usuario = createParamDecorator((_: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
  const usuario = contexto.switchToHttp().getRequest<RequisicaoAutenticada>().usuario;
  if (!usuario) throw new UnauthorizedException();
  return usuario;
});

export function verificarJwtHs256(token: string, segredo: string, agora = Date.now()): Record<string, unknown> | null {
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [cabecalho, corpo, assinatura] = partes;

  try {
    const alg = JSON.parse(Buffer.from(cabecalho, 'base64url').toString()).alg;
    if (alg !== 'HS256') return null;

    const esperada = createHmac('sha256', segredo).update(`${cabecalho}.${corpo}`).digest();
    const recebida = Buffer.from(assinatura, 'base64url');
    if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;

    const payload = JSON.parse(Buffer.from(corpo, 'base64url').toString());
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= agora) return null;
    return payload;
  } catch {
    return null;
  }
}
