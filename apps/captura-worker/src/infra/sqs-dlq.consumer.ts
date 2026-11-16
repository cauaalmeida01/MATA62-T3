import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ProcessarDlqUseCase } from '../aplicacao';
import { MensagemFilaCapturaV1 } from '../dominio';

@Injectable()
export class SqsDlqConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SqsDlqConsumer.name);
  private readonly sqsClient: SQSClient;
  private readonly filaDlqUrl: string;
  private ativo = false;
  private promessaLoop: Promise<void> | null = null;

  constructor(
    private readonly processarDlqUseCase: ProcessarDlqUseCase,
    @Optional() sqsClientCustomizado?: SQSClient,
  ) {
    this.filaDlqUrl =
      process.env.FILA_CAPTURA_DLQ_URL ?? 'http://elasticmq:9324/000000000000/captura-dlq';
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
    this.logger.log(`Iniciando consumo da DLQ de captura (${this.filaDlqUrl})`);
    this.promessaLoop = this.executarLoop();
  }

  async onModuleDestroy(): Promise<void> {
    this.ativo = false;
    if (this.promessaLoop) {
      await this.promessaLoop.catch(() => undefined);
      this.promessaLoop = null;
    }
  }

  async processarMensagemDlqUnica(mensagemSqs: Message): Promise<boolean> {
    if (!mensagemSqs.Body || !mensagemSqs.ReceiptHandle) {
      return false;
    }

    const payload = JSON.parse(mensagemSqs.Body) as MensagemFilaCapturaV1;
    await this.processarDlqUseCase.executar(payload);

    await this.sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: this.filaDlqUrl,
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
            QueueUrl: this.filaDlqUrl,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 10,
          }),
        );

        const mensagens = resposta.Messages ?? [];
        for (const msg of mensagens) {
          if (!this.ativo) break;
          try {
            await this.processarMensagemDlqUnica(msg);
          } catch (erro) {
            this.logger.error(
              `Erro ao processar mensagem ${msg.MessageId ?? 'sem-id'} da captura-dlq`,
              erro,
            );
          }
        }
      } catch (erro) {
        if (!this.ativo) break;
        this.logger.error('Erro ao consultar fila captura-dlq no ElasticMQ', erro);
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }
  }
}
