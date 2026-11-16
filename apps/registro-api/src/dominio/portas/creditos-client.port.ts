export const CREDITOS_CLIENT = Symbol('CREDITOS_CLIENT');

export interface ReservarCreditoInput {
  userId: string;
  solicitacaoId: string;
  quantidade: number;
}

export interface ReservarCreditoOutput {
  reservaId: string;
}

export interface ICreditosClient {
  reservarCredito(input: ReservarCreditoInput): Promise<ReservarCreditoOutput>;
  liberarReserva(reservaId: string): Promise<void>;
}
