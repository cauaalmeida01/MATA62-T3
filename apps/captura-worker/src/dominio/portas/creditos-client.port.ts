export const CREDITOS_WORKER_CLIENT = Symbol('CREDITOS_WORKER_CLIENT');

export interface ICreditosClient {
  liberarReserva(reservaId: string, motivo?: string): Promise<void>;
}
