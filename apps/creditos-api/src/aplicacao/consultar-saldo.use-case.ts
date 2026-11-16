import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '@app/compartilhado';
import { IUnidadeDeTrabalhoCreditos, UNIDADE_DE_TRABALHO_CREDITOS } from '../dominio';
import { SaldoOutput } from './criar-carteira.use-case';

@Injectable()
export class ConsultarSaldoUseCase {
  constructor(@Inject(UNIDADE_DE_TRABALHO_CREDITOS) private readonly uow: IUnidadeDeTrabalhoCreditos) {}

  async executar(userId: string): Promise<SaldoOutput> {
    const carteira = await this.uow.executar((repo) => repo.buscarCarteira(userId));
    if (!carteira) {
      throw new RecursoNaoEncontrado('Carteira não encontrada');
    }
    return { disponivel: carteira.disponivel, reservado: carteira.reservado };
  }
}
