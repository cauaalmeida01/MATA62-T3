import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ProcessarCapturaUseCase } from '../aplicacao';
import { MensagemFilaCapturaV1 } from '../dominio';

@Injectable()
export class SqsCapturaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SqsCapturaConsumer.name);
  private readonly sqsClient: SQSClient;
  private readonly filaUrl: string;
  private ativo = false;
  private promessaLoop: Promise<void> | null = null;

  constructor(
    private readonly processarCapturaUseCase: ProcessarCapturaUseCase,
    @Optional() sqsClientCustomizado?: SQSClient,
  ) {
    this.filaUrl =
      process.env.FILA_CAPTURA_URL ?? 'http://elasticmq:9324/000000000000/captura';
    this.sqsClient =
      sqsClientCustomizado ??
      new SQSClient({
        endpoint: process.env.SQS_ENDPOINT ?? 'http://elasticmq:9324',
        region: process.env.SQS_REGION ?? 'elasticmq',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'x',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'x',
        },
      });
  }

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    this.iniciar();
  }

  iniciar(): void {
    if (this.ativo) {
      return;
    }
    this.ativo = true;
    this.logger.log(`Iniciando consumo da fila principal de captura (${this.filaUrl})`);
    this.promessaLoop = this.executarLoop();
  }

  async onModuleDestroy(): Promise<void> {
    this.ativo = false;
    if (this.promessaLoop) {
      await this.promessaLoop.catch(() => undefined);
      this.promessaLoop = null;
    }
  }

  async processarMensagemUnica(mensagemSqs: Message): Promise<boolean> {
    if (!mensagemSqs.Body || !mensagemSqs.ReceiptHandle) {
      return false;
    }

    const payload = JSON.parse(mensagemSqs.Body) as MensagemFilaCapturaV1;
    await this.processarCapturaUseCase.executar(payload);

    // Só confirma (deleta) a mensagem depois que a conclusão respondeu com sucesso
    await this.sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: this.filaUrl,
        ReceiptHandle: mensagemSqs.ReceiptHandle,
      }),
    );

    return true;
  }

  private async executarLoop(): Promise<void> {
    while (this.ativo) {
      try {
        const resposta = await this.sqsClient.send(
          new ReceiveMessageCommand({
            QueueUrl: this.filaUrl,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 10,
          }),
        );

        const mensagens = resposta.Messages ?? [];
        for (const msg of mensagens) {
          if (!this.ativo) break;
          try {
            await this.processarMensagemUnica(msg);
          } catch (erro) {
            // Não apaga a mensagem para que o ElasticMQ reentregue até 3 vezes e envie à DLQ
            this.logger.warn(
              `Mensagem ${msg.MessageId ?? 'sem-id'} falhou na fila captura; aguardando nova tentativa ou redirecionamento para DLQ`,
              erro instanceof Error ? erro.message : String(erro),
            );
          }
        }
      } catch (erro) {
        if (!this.ativo) break;
        this.logger.error('Erro ao consultar fila principal de captura no ElasticMQ', erro);
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }
  }
}
