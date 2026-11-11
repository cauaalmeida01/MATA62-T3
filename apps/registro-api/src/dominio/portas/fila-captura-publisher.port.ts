import { ModoCaptura } from '../solicitacao-registro.entity';

export const FILA_CAPTURA_PUBLISHER = Symbol('FILA_CAPTURA_PUBLISHER');

/**
 * Formato da mensagem publicada na fila `captura` (docs/contratos.md, seção 4).
 */
export interface MensagemFilaCapturaV1 {
  versao: 1;
  solicitacaoId: string;
  reservaId: string;
  userId: string;
  url: string;
  titulo: string;
  modo: ModoCaptura;
  solicitadoEm: string;
}

export interface IFilaCapturaPublisher {
  publicarSolicitacao(mensagem: MensagemFilaCapturaV1): Promise<void>;
}
