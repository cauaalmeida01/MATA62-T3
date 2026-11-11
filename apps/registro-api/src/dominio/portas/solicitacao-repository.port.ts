import { SolicitacaoRegistro, StatusSolicitacao } from '../solicitacao-registro.entity';

export const SOLICITACAO_REPOSITORY = Symbol('SOLICITACAO_REPOSITORY');

export interface ISolicitacaoRepository {
  criar(solicitacao: SolicitacaoRegistro): Promise<void>;
  buscarPorId(id: string): Promise<SolicitacaoRegistro | null>;
  atualizarStatus(id: string, status: StatusSolicitacao, ultimoErro?: string | null): Promise<void>;
  listarPendentesTravadas(minutos: number): Promise<SolicitacaoRegistro[]>;
}
