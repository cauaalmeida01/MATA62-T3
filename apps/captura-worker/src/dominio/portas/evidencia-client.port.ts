import {
  ArquivoCapturado,
  MetadadosEvidenciaInput,
  PacoteEvidenciaSelado,
} from '../modelos';

export const EVIDENCIA_CLIENT = Symbol('EVIDENCIA_CLIENT');

export interface SelarEvidenciaInput {
  metadados: MetadadosEvidenciaInput;
  arquivos: ArquivoCapturado[];
}

export interface IEvidenciaClient {
  selarEvidencia(dados: SelarEvidenciaInput): Promise<PacoteEvidenciaSelado>;
}
