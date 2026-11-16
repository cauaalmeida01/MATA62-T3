import { Injectable } from '@nestjs/common';
import { CreditosDatabaseService } from '@app/infra';
import { IRepositorioCreditos, IUnidadeDeTrabalhoCreditos } from '../dominio';
import { PostgresRepositorioCreditos } from './postgres-repositorio-creditos';

/** Abre BEGIN ... COMMIT (ou ROLLBACK) e entrega ao caso de uso um repositório nessa transação. */
@Injectable()
export class PostgresUnidadeDeTrabalhoCreditos implements IUnidadeDeTrabalhoCreditos {
  constructor(private readonly db: CreditosDatabaseService) {}

  executar<T>(trabalho: (repositorio: IRepositorioCreditos) => Promise<T>): Promise<T> {
    return this.db.transacao((cliente) => trabalho(new PostgresRepositorioCreditos(cliente)));
  }
}
