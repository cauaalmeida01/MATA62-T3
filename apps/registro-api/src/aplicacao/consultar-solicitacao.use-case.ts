import { Inject, Injectable } from '@nestjs/common';
import { AcessoNegado, RecursoNaoEncontrado } from '@app/compartilhado';
import {
  ISolicitacaoRepository,
  ModoCaptura,
  SOLICITACAO_REPOSITORY,
  StatusSolicitacao,
} from '../dominio';

export interface ConsultarSolicitacaoQuery {
  solicitacaoId: string;
  userIdAutenticado: string;
}

export interface ConsultarSolicitacaoOutput {
  id: string;
  solicitacaoId: string;
  userId: string;
  url: string;
  titulo: string;
  modo: ModoCaptura;
  status: StatusSolicitacao;
  reservaId: string;
  ultimoErro: string | null;
  criadaEm: string;
  atualizadaEm: string;
}

@Injectable()
export class ConsultarSolicitacaoUseCase {
  constructor(
    @Inject(SOLICITACAO_REPOSITORY)
    private readonly solicitacaoRepository: ISolicitacaoRepository,
  ) {}

  async executar(query: ConsultarSolicitacaoQuery): Promise<ConsultarSolicitacaoOutput> {
    const solicitacao = await this.solicitacaoRepository.buscarPorId(query.solicitacaoId);

    if (!solicitacao) {
      throw new RecursoNaoEncontrado('Solicitação de registro não encontrada');
    }

    if (!solicitacao.pertenceAoUsuario(query.userIdAutenticado)) {
      throw new AcessoNegado('Você não tem permissão para consultar esta solicitação');
    }

    return {
      id: solicitacao.id,
      solicitacaoId: solicitacao.id,
      userId: solicitacao.userId,
      url: solicitacao.url,
      titulo: solicitacao.titulo,
      modo: solicitacao.modo,
      status: solicitacao.status,
      reservaId: solicitacao.reservaId,
      ultimoErro: solicitacao.ultimoErro,
      criadaEm: solicitacao.criadaEm.toISOString(),
      atualizadaEm: solicitacao.atualizadaEm.toISOString(),
    };
  }
}
