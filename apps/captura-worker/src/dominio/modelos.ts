export type ModoCaptura = 'TELA';

export type StatusSolicitacao = 'PENDENTE' | 'PROCESSANDO' | 'CONCLUIDA' | 'FALHOU';

/**
 * Formato v1 da mensagem nas filas `captura` e `captura-dlq` (docs/contratos.md, seção 4).
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

export interface SolicitacaoWorker {
  id: string;
  userId: string;
  url: string;
  titulo: string;
  modo: ModoCaptura;
  status: StatusSolicitacao;
  reservaId: string;
  ultimoErro: string | null;
  criadaEm: Date;
  atualizadaEm: Date;
}

export interface ArquivoCapturado {
  nome: string;
  tipo: 'TELA' | 'HAR';
  mimeType: string;
  conteudo: Buffer;
}

export interface ResultadoCaptura {
  inicio: Date;
  fim: Date;
  urlFinal: string;
  statusHttp: number | null;
  userAgent: string;
  viewport: { width: number; height: number };
  arquivos: ArquivoCapturado[];
}

/**
 * Metadados enviados para `POST /api/internal/evidencias` (docs/contratos.md, seção 3).
 */
export interface MetadadosEvidenciaInput {
  solicitacaoId: string;
  userId: string;
  url: string;
  inicio: string;
  fim: string;
}

export interface ArquivoEvidenciaSelado {
  nome: string;
  tipo: string;
  sha256: string;
  tamanhoBytes: number;
  chave: string;
}

export interface CarimboTempoEvidencia {
  fonte: 'FREETSA' | 'RELOGIO_LOCAL' | string;
  horario: string;
  tokenBase64?: string;
}

/**
 * Pacote selado devolvido pela `evidencia-api` (docs/contratos.md, seção 3).
 */
export interface PacoteEvidenciaSelado {
  evidenciaId: string;
  manifestoSha256: string;
  carimbo: CarimboTempoEvidencia;
  arquivos: ArquivoEvidenciaSelado[];
}

/**
 * Corpo enviado para `POST /api/internal/registros/:solicitacaoId/conclusao` (docs/contratos.md, seção 3).
 */
export interface ConclusaoRegistroPayload {
  userId: string;
  reservaId: string;
  url: string;
  titulo: string;
  inicio: string;
  fim: string;
  pacote: PacoteEvidenciaSelado;
}
