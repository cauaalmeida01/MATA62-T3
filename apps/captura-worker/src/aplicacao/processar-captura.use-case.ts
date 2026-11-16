import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  EVIDENCIA_CLIENT,
  IEvidenciaClient,
  IMotorCaptura,
  IRelatoriosClient,
  ISolicitacaoWorkerRepository,
  IValidadorUrlSegura,
  MensagemFilaCapturaV1,
  MOTOR_CAPTURA,
  RELATORIOS_CLIENT,
  SOLICITACAO_WORKER_REPOSITORY,
  VALIDADOR_URL_SEGURA_WORKER,
} from '../dominio';

export interface ProcessarCapturaOutput {
  solicitacaoId: string;
  status: 'CONCLUIDA' | 'JA_CONCLUIDA';
  evidenciaId?: string;
  registroId?: string;
}

@Injectable()
export class ProcessarCapturaUseCase {
  private readonly logger = new Logger(ProcessarCapturaUseCase.name);

  constructor(
    @Inject(SOLICITACAO_WORKER_REPOSITORY)
    private readonly solicitacaoRepository: ISolicitacaoWorkerRepository,
    @Inject(VALIDADOR_URL_SEGURA_WORKER)
    private readonly validadorUrlSegura: IValidadorUrlSegura,
    @Inject(MOTOR_CAPTURA)
    private readonly motorCaptura: IMotorCaptura,
    @Inject(EVIDENCIA_CLIENT)
    private readonly evidenciaClient: IEvidenciaClient,
    @Inject(RELATORIOS_CLIENT)
    private readonly relatoriosClient: IRelatoriosClient,
  ) {}

  async executar(mensagem: MensagemFilaCapturaV1): Promise<ProcessarCapturaOutput> {
    const solicitacaoExistente = await this.solicitacaoRepository.buscarPorId(
      mensagem.solicitacaoId,
    );

    // 1. Idempotência: se a solicitação já está CONCLUIDA, confirma sem reprocessar
    if (solicitacaoExistente?.status === 'CONCLUIDA') {
      this.logger.log(
        `Solicitação ${mensagem.solicitacaoId} já se encontra CONCLUIDA; ignorando de forma idempotente`,
      );
      return {
        solicitacaoId: mensagem.solicitacaoId,
        status: 'JA_CONCLUIDA',
      };
    }

    // 2. Atualiza status para PROCESSANDO
    await this.solicitacaoRepository.marcarProcessando(mensagem.solicitacaoId);

    try {
      // 3. Revalida a URL contra SSRF (proteção contra DNS Rebinding no instante da captura)
      await this.validadorUrlSegura.validar(mensagem.url);

      // 4. Executa a captura (screenshot PNG + arquivo HAR)
      const resultadoCaptura = await this.motorCaptura.capturar({
        url: mensagem.url,
        modo: mensagem.modo,
        solicitacaoId: mensagem.solicitacaoId,
      });

      const inicioIso = resultadoCaptura.inicio.toISOString();
      const fimIso = resultadoCaptura.fim.toISOString();

      // 5. Envia os arquivos e metadados para a evidencia-api selar (SHA-256 + RFC 3161 + S3 Object Lock)
      const pacoteSelado = await this.evidenciaClient.selarEvidencia({
        metadados: {
          solicitacaoId: mensagem.solicitacaoId,
          userId: mensagem.userId,
          url: mensagem.url,
          inicio: inicioIso,
          fim: fimIso,
        },
        arquivos: resultadoCaptura.arquivos,
      });

      // 6. Envia a conclusão para a relatorios-api (que efetiva a reserva de crédito)
      const { registroId } = await this.relatoriosClient.concluirRegistro(
        mensagem.solicitacaoId,
        {
          userId: mensagem.userId,
          reservaId: mensagem.reservaId,
          url: mensagem.url,
          titulo: mensagem.titulo,
          inicio: inicioIso,
          fim: fimIso,
          pacote: pacoteSelado,
        },
      );

      // 7. Marca a solicitação como CONCLUIDA no schema registro
      await this.solicitacaoRepository.marcarConcluida(mensagem.solicitacaoId);

      return {
        solicitacaoId: mensagem.solicitacaoId,
        status: 'CONCLUIDA',
        evidenciaId: pacoteSelado.evidenciaId,
        registroId,
      };
    } catch (erro) {
      const mensagemErro =
        erro instanceof Error ? erro.message : 'Erro inesperado durante o processamento da captura';

      this.logger.warn(
        `Falha ao processar solicitação ${mensagem.solicitacaoId}: ${mensagemErro}`,
      );

      await this.solicitacaoRepository
        .registrarTentativaComErro(mensagem.solicitacaoId, mensagemErro)
        .catch((erroBanco) => {
          this.logger.error(
            `Não foi possível gravar ultimo_erro na solicitação ${mensagem.solicitacaoId}`,
            erroBanco,
          );
        });

      // Relança a exceção para que o consumidor NÃO apague a mensagem da fila principal
      // e o ElasticMQ aplique as 3 tentativas antes de enviar para a captura-dlq.
      throw erro;
    }
  }
}
