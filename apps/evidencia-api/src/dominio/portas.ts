import {
  EvidenciaParaSalvar,
  EvidenciaPersistida,
  CarimboTempo,
} from './modelos';

export const EVIDENCIA_REPOSITORY = Symbol('EVIDENCIA_REPOSITORY');
export const ARMAZENAMENTO_EVIDENCIA = Symbol('ARMAZENAMENTO_EVIDENCIA');
export const CARIMBADOR_TEMPO = Symbol('CARIMBADOR_TEMPO');

export interface IEvidenciaRepository {
  buscarPorSolicitacao(solicitacaoId: string): Promise<EvidenciaPersistida | null>;
  salvar(dados: EvidenciaParaSalvar): Promise<EvidenciaPersistida>;
}

export interface IArmazenamentoEvidencia {
  gravar(chave: string, conteudo: Buffer, mimeType: string): Promise<void>;
}

export interface ICarimbadorTempo {
  carimbar(hashSha256: string): Promise<CarimboTempo>;
}
