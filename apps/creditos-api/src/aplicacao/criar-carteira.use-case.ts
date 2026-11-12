import { Inject, Injectable } from '@nestjs/common';
import { Carteira, IUnidadeDeTrabalhoCreditos, UNIDADE_DE_TRABALHO_CREDITOS } from '../dominio';
import { CREDITOS_INICIAIS } from './configuracao';

export interface SaldoOutput {
  disponivel: number;
  reservado: number;
}

/** Chamado pela contas-api no cadastro. Repetir a chamada não dá créditos de novo. */
@Injectable()
export class CriarCarteiraUseCase {
  constructor(
    @Inject(UNIDADE_DE_TRABALHO_CREDITOS) private readonly uow: IUnidadeDeTrabalhoCreditos,
    @Inject(CREDITOS_INICIAIS) private readonly creditosIniciais: number,
  ) {}

  async executar(userId: string): Promise<SaldoOutput & { criada: boolean }> {
    return this.uow.executar(async (repo) => {
      const criada = await repo.criarCarteiraSeNaoExistir(Carteira.nova(userId, this.creditosIniciais));
      const carteira = (await repo.buscarCarteira(userId))!;
      return { criada, disponivel: carteira.disponivel, reservado: carteira.reservado };
    });
  }
}
