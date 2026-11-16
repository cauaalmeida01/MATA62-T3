import { Inject, Injectable } from '@nestjs/common';
import { ITokensRevogados, TOKENS_REVOGADOS } from '@app/compartilhado';

/**
 * REQ04: sair. O JWT não tem "desligar": ele vale até expirar. Por isso o logout
 * anota o jti do token na lista de revogados, que todo serviço consulta no guard.
 * A anotação vale só até a expiração do token; depois ele já seria recusado de qualquer jeito.
 */
@Injectable()
export class SairUseCase {
  constructor(@Inject(TOKENS_REVOGADOS) private readonly tokensRevogados: ITokensRevogados) {}

  async executar(sessao: { jti: string; expiraEm: Date }): Promise<void> {
    await this.tokensRevogados.revogar(sessao.jti, sessao.expiraEm);
  }
}
