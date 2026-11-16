import { Conflito, RecursoNaoEncontrado } from '@app/compartilhado';

/** Erros de domínio próprios da relatorios-api. O filtro comum converte em HTTP. */

export class RegistroNaoEncontrado extends RecursoNaoEncontrado {
  constructor() {
    super('Registro não encontrado');
  }
}

/** A reserva foi liberada (a captura foi dada como falha) antes da conclusão chegar. */
export class ReservaJaLiberada extends Conflito {
  constructor(reservaId: string) {
    super(`A reserva ${reservaId} já foi liberada; a captura foi dada como falha`);
  }
}

/** Chegou uma conclusão repetida, mas com dados de outro usuário. */
export class ConclusaoDivergente extends Conflito {
  constructor(solicitacaoId: string) {
    super(`A solicitação ${solicitacaoId} já foi concluída com outros dados`);
  }
}
