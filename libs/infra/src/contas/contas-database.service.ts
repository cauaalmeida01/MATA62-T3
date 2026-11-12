import { Injectable } from '@nestjs/common';
import { BancoPostgres, DDL_TOKENS_REVOGADOS } from '../postgres/banco-postgres';

export const DDL_SCHEMA_CONTAS = `
CREATE SCHEMA IF NOT EXISTS contas;

CREATE TABLE IF NOT EXISTS contas.usuarios (
  id UUID PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  tipo VARCHAR(16) NOT NULL CHECK (tipo IN ('ADVOGADO', 'COMUM')),
  cpf_cifrado TEXT NOT NULL,
  cpf_hash CHAR(64) NOT NULL UNIQUE,
  oab VARCHAR(32) NULL,
  telefone VARCHAR(32) NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (tipo <> 'ADVOGADO' OR oab IS NOT NULL)
);
${DDL_TOKENS_REVOGADOS}`;

@Injectable()
export class ContasDatabaseService extends BancoPostgres {
  constructor() {
    super(DDL_SCHEMA_CONTAS);
  }
}
