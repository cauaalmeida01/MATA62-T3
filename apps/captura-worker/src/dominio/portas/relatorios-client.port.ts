import { ConclusaoRegistroPayload } from '../modelos';

export const RELATORIOS_CLIENT = Symbol('RELATORIOS_CLIENT');

export interface IRelatoriosClient {
  concluirRegistro(
    solicitacaoId: string,
    payload: ConclusaoRegistroPayload,
  ): Promise<{ registroId: string }>;
}
