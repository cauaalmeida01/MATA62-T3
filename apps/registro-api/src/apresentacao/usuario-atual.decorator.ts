import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AcessoNegado } from '@app/compartilhado';
import { RequisicaoAutenticada, UsuarioAutenticado } from './jwt-auth.guard';

export const UsuarioAtual = createParamDecorator(
  (propriedade: keyof UsuarioAutenticado | undefined, ctx: ExecutionContext) => {
    const requisicao = ctx.switchToHttp().getRequest<RequisicaoAutenticada>();
    const usuario = requisicao.usuario;

    if (!usuario) {
      throw new AcessoNegado('Usuário não autenticado');
    }

    return propriedade ? usuario[propriedade] : usuario;
  },
);
