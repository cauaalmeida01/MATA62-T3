import { SolicitacaoWorker } from '../modelos';

export const SOLICITACAO_WORKER_REPOSITORY = Symbol('SOLICITACAO_WORKER_REPOSITORY');

export interface ISolicitacaoWorkerRepository {
  buscarPorId(id: string): Promise<SolicitacaoWorker | null>;
  marcarProcessando(id: string): Promise<void>;
  marcarConcluida(id: string): Promise<void>;
  marcarFalhou(id: string, motivo: string): Promise<void>;
  registrarTentativaComErro(id: string, motivo: string): Promise<void>;
  listarPendentesOuProcessandoTravadas(minutos: number): Promise<SolicitacaoWorker[]>;
}
