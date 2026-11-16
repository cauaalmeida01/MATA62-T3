import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Injectable, Logger } from '@nestjs/common';
import {
  FalhaIntegracaoInternaError,
  IFilaCapturaPublisher,
  MensagemFilaCapturaV1,
} from '../dominio';

@Injectable()
export class SqsFilaCapturaPublisher implements IFilaCapturaPublisher {
  private readonly logger = new Logger(SqsFilaCapturaPublisher.name);
  private readonly sqsClient: SQSClient;
  private readonly filaCapturaUrl: string;

  constructor(sqsClientCustomizado?: SQSClient) {
    this.filaCapturaUrl =
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

  async publicarSolicitacao(mensagem: MensagemFilaCapturaV1): Promise<void> {
    try {
      await this.sqsClient.send(
        new SendMessageCommand({
          QueueUrl: this.filaCapturaUrl,
          MessageBody: JSON.stringify(mensagem),
        }),
      );
    } catch (erro) {
      this.logger.error(
        `Falha ao publicar solicitação ${mensagem.solicitacaoId} na fila ${this.filaCapturaUrl}`,
        erro,
      );
      throw new FalhaIntegracaoInternaError(
        'Não foi possível enfileirar a solicitação para captura',
      );
    }
  }
}
