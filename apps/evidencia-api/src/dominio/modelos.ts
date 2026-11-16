/** Contrato do Serviço Evidência — docs/contratos.md, seção 3. */
export interface MetadadosEvidencia {
  solicitacaoId: string;
  userId: string;
  url: string;
  inicio: string;
  fim: string;
}

export type TipoArquivo = 'TELA' | 'HAR' | 'HTML';

export interface ArquivoRecebido {
  nome: string;
  mimeType: string;
  conteudo: Buffer;
}

export interface ArquivoSelado {
  nome: string;
  tipo: TipoArquivo;
  sha256: string;
  tamanhoBytes: number;
  chave: string;
}

export interface CarimboTempo {
  fonte: 'FREETSA' | 'RELOGIO_LOCAL';
  horario: string;
  tokenBase64?: string;
}

export interface PacoteSelado {
  evidenciaId: string;
  manifestoSha256: string;
  carimbo: CarimboTempo;
  arquivos: ArquivoSelado[];
}

export interface EvidenciaPersistida {
  userId: string;
  pacote: PacoteSelado;
}

export interface EvidenciaParaSalvar {
  metadados: MetadadosEvidencia;
  pacote: PacoteSelado;
}
