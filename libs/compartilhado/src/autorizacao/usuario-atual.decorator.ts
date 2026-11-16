import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AcessoNegado } from '../erros/erros-dominio';
import { RequisicaoAutenticada, UsuarioAutenticado } from './jwt-auth.guard';

/** Entrega ao controller o usuário que o JwtAuthGuard colocou na requisição. */
export const UsuarioAtual = createParamDecorator(
  (campo: keyof UsuarioAutenticado | undefined, contexto: ExecutionContext) => {
    const usuario = contexto.switchToHttp().getRequest<RequisicaoAutenticada>().usuario;
    if (!usuario) {
      throw new AcessoNegado('Usuário não autenticado');
    }
    return campo ? usuario[campo] : usuario;
  },
);
