import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CREDITOS_CLIENT,
  FILA_CAPTURA_PUBLISHER,
  ICreditosClient,
  IFilaCapturaPublisher,
  ISolicitacaoRepository,
  IValidadorUrlSegura,
  ModoCaptura,
  SOLICITACAO_REPOSITORY,
  SolicitacaoRegistro,
  StatusSolicitacao,
  VALIDADOR_URL_SEGURA,
} from '../dominio';

export interface CriarSolicitacaoCommand {
  userId: string;
  url: string;
  titulo: string;
  modo: ModoCaptura;
}

export interface CriarSolicitacaoOutput {
  solicitacaoId: string;
  status: StatusSolicitacao;
}

@Injectable()
export class CriarSolicitacaoUseCase {
  private readonly logger = new Logger(CriarSolicitacaoUseCase.name);

  constructor(
    @Inject(VALIDADOR_URL_SEGURA)
    private readonly validadorUrlSegura: IValidadorUrlSegura,
    @Inject(CREDITOS_CLIENT)
    private readonly creditosClient: ICreditosClient,
    @Inject(SOLICITACAO_REPOSITORY)
    private readonly solicitacaoRepository: ISolicitacaoRepository,
    @Inject(FILA_CAPTURA_PUBLISHER)
    private readonly filaCapturaPublisher: IFilaCapturaPublisher,
  ) {}

  async executar(comando: CriarSolicitacaoCommand): Promise<CriarSolicitacaoOutput> {
    const urlNormalizada = comando.url.trim();
    const tituloNormalizado = comando.titulo.trim();

    // 1. Valida a URL contra SSRF antes de reservar créditos
    await this.validadorUrlSegura.validar(urlNormalizada);

    // 2. Gera o ID da solicitação e reserva 1 crédito no creditos-api
    const solicitacaoId = randomUUID();
    const { reservaId } = await this.creditosClient.reservarCredito({
      userId: comando.userId,
      solicitacaoId,
      quantidade: 1,
    });

    // 3. Instancia a entidade em estado PENDENTE e persiste no schema registro
    const agora = new Date();
    const solicitacao = SolicitacaoRegistro.criarNova({
      id: solicitacaoId,
      userId: comando.userId,
      url: urlNormalizada,
      titulo: tituloNormalizado,
      modo: comando.modo,
      reservaId,
      agora,
    });

    try {
      await this.solicitacaoRepository.criar(solicitacao);
    } catch (erro) {
      this.logger.warn(
        `Falha ao gravar solicitação ${solicitacaoId}; liberando reserva ${reservaId}`,
      );
      await this.creditosClient.liberarReserva(reservaId).catch((erroLiberacao) => {
        this.logger.error(
          `Não foi possível liberar reserva ${reservaId} imediatamente (será tratada pela reconciliação)`,
          erroLiberacao,
        );
      });
      throw erro;
    }

    // 4. Publica a mensagem v1 na fila de captura
    try {
      await this.filaCapturaPublisher.publicarSolicitacao({
        versao: 1,
        solicitacaoId: solicitacao.id,
        reservaId: solicitacao.reservaId,
        userId: solicitacao.userId,
        url: solicitacao.url,
        titulo: solicitacao.titulo,
        modo: solicitacao.modo,
        solicitadoEm: solicitacao.criadaEm.toISOString(),
      });
    } catch (erro) {
      this.logger.warn(
        `Falha ao publicar solicitação ${solicitacaoId} na fila; revertendo status e liberando reserva ${reservaId}`,
      );
      const mensagemErro =
        erro instanceof Error ? erro.message : 'Falha ao publicar solicitação na fila de captura';
      await this.solicitacaoRepository
        .atualizarStatus(solicitacao.id, 'FALHOU', mensagemErro)
        .catch((erroStatus) => {
          this.logger.error(
            `Não foi possível marcar solicitação ${solicitacaoId} como FALHOU`,
            erroStatus,
          );
        });
      await this.creditosClient.liberarReserva(reservaId).catch((erroLiberacao) => {
        this.logger.error(
          `Não foi possível liberar reserva ${reservaId} imediatamente (será tratada pela reconciliação)`,
          erroLiberacao,
        );
      });
      throw erro;
    }

    // 5. Retorna conforme contrato: 202 { solicitacaoId, status: "PENDENTE" }
    return {
      solicitacaoId: solicitacao.id,
      status: solicitacao.status,
    };
  }
}
