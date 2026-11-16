import { Injectable } from '@nestjs/common';
import { BancoPostgres, DDL_TOKENS_REVOGADOS } from '../postgres/banco-postgres';

// Os CHECK são a última linha de defesa: mesmo com um bug no código,
// o banco recusa saldo negativo ou status desconhecido.
export const DDL_SCHEMA_CREDITOS = `
CREATE SCHEMA IF NOT EXISTS creditos;

CREATE TABLE IF NOT EXISTS creditos.carteiras (
  user_id UUID PRIMARY KEY,
  disponivel INTEGER NOT NULL CHECK (disponivel >= 0),
  reservado INTEGER NOT NULL CHECK (reservado >= 0),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS creditos.reservas (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES creditos.carteiras (user_id),
  solicitacao_id UUID NOT NULL UNIQUE,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  status VARCHAR(16) NOT NULL CHECK (status IN ('RESERVADA', 'EFETIVADA', 'LIBERADA')),
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  encerrada_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_creditos_reservas_status_criada_em
  ON creditos.reservas (status, criada_em);
${DDL_TOKENS_REVOGADOS}`;

@Injectable()
export class CreditosDatabaseService extends BancoPostgres {
  constructor() {
    super(DDL_SCHEMA_CREDITOS);
  }
}
