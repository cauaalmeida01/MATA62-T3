import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AcessoNegado } from '../erros/erros-dominio';
import { segredoJwt, verificarJwt } from './jwt';
import { ITokensRevogados, TOKENS_REVOGADOS } from './tokens-revogados.port';

export interface UsuarioAutenticado {
  id: string;
  jti: string;
  tipo: 'ADVOGADO' | 'COMUM';
  expiraEm: Date;
}

export interface RequisicaoAutenticada extends Request {
  usuario?: UsuarioAutenticado;
}

/**
 * Guard de autenticação reaproveitado pelos serviços (ADR-001 do T2: o token é
 * validado em cada serviço). Confere o JWT e, depois, a lista de revogados.
 * Depende da porta ITokensRevogados, não do PostgreSQL: cada serviço liga o adaptador.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TOKENS_REVOGADOS) private readonly tokensRevogados: ITokensRevogados) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const requisicao = contexto.switchToHttp().getRequest<RequisicaoAutenticada>();
    const cabecalho = requisicao.headers.authorization ?? '';
    const [esquema, token] = cabecalho.trim().split(/\s+/);
    if (esquema?.toLowerCase() !== 'bearer' || !token) {
      throw new AcessoNegado('Envie o cabeçalho Authorization: Bearer <token>');
    }

    const payload = verificarJwt(token, segredoJwt());
    if (await this.tokensRevogados.estaRevogado(payload.jti)) {
      throw new AcessoNegado('Sessão encerrada; faça login de novo');
    }

    requisicao.usuario = {
      id: payload.sub,
      jti: payload.jti,
      tipo: payload.tipo,
      expiraEm: new Date(payload.exp * 1000),
    };
    return true;
  }
}
