import { Injectable } from '@nestjs/common';
import { BancoPostgres } from '@app/infra';
import { DDL_TRILHA_AUDITORIA } from '@app/infra/auditoria/trilha-auditoria.repository';

export const DDL_EVIDENCIAS = `
CREATE SCHEMA IF NOT EXISTS evidencia;
CREATE TABLE IF NOT EXISTS evidencia.evidencias (
  id UUID PRIMARY KEY,
  solicitacao_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  manifesto_sha256 CHAR(64) NOT NULL,
  carimbo_fonte VARCHAR(32) NOT NULL,
  carimbo_horario TIMESTAMPTZ NOT NULL,
  carimbo_token TEXT NULL,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS evidencia.arquivos (
  id UUID PRIMARY KEY,
  evidencia_id UUID NOT NULL REFERENCES evidencia.evidencias(id),
  nome TEXT NOT NULL,
  tipo VARCHAR(16) NOT NULL,
  sha256 CHAR(64) NOT NULL,
  tamanho_bytes BIGINT NOT NULL,
  chave TEXT NOT NULL,
  UNIQUE (evidencia_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_evidencia_arquivos_evidencia_id ON evidencia.arquivos (evidencia_id);
`;

@Injectable()
export class EvidenciaDatabaseService extends BancoPostgres {
  constructor() {
    super(DDL_EVIDENCIAS + DDL_TRILHA_AUDITORIA);
  }
}
