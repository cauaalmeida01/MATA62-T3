import { Inject, Injectable } from '@nestjs/common';
import { ConclusaoDivergente } from '../dominio/erros';
import { CREDITOS_CLIENT, CreditosClient, REGISTRO_REPOSITORIO, RegistroRepositorio } from '../dominio/portas';
import { NovoRegistro, Registro } from '../dominio/registro';

export interface ResultadoConclusao {
  registroId: string;
  /** true quando o registro foi criado agora; false quando a chamada era repetida. */
  criado: boolean;
}

/**
 * REQ11 — Concluir captura de tela (comp. 15 Conclusão do Registro).
 * Chamado pelo captura-worker depois que a evidencia-api selou o pacote.
 *
 * Ordem importa:
 *  1. Repetida? Devolve o mesmo registro (o worker pode reenviar após uma falha de rede).
 *  2. Efetiva o crédito ANTES de gravar. Se gravar falhar depois, o worker reenvia e
 *     efetivar de novo é idempotente. Gravando antes, uma falha ao efetivar deixaria um
 *     registro pronto com a reserva aberta, e a reconciliação a liberaria: captura de graça.
 *  3. Grava o registro.
 */
@Injectable()
export class ConcluirRegistro {
  constructor(
    @Inject(REGISTRO_REPOSITORIO) private readonly registros: RegistroRepositorio,
    @Inject(CREDITOS_CLIENT) private readonly creditos: CreditosClient,
  ) {}

  async executar(dados: NovoRegistro): Promise<ResultadoConclusao> {
    const existente = await this.registros.buscarPorSolicitacao(dados.solicitacaoId);
    if (existente) return this.repetida(existente, dados);

    // Valida antes de consumir o crédito: dado inválido não pode custar crédito.
    const registro = Registro.criar(dados);

    await this.creditos.efetivar(dados.reservaId);

    const salvo = await this.registros.salvar(registro);
    if (salvo.id !== registro.id) return this.repetida(salvo, dados);
    return { registroId: salvo.id, criado: true };
  }

  private repetida(existente: Registro, dados: NovoRegistro): ResultadoConclusao {
    if (!existente.pertenceA(dados.userId)) throw new ConclusaoDivergente(dados.solicitacaoId);
    return { registroId: existente.id, criado: false };
  }
}
