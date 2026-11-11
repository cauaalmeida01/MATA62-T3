import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

/**
 * Worker de captura (no T2: tarefas ECS Fargate consumindo o SQS).
 * Não abre porta HTTP. Mais capacidade = mais réplicas:
 *   docker compose up --scale captura-worker=3
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  const logger = new Logger('captura-worker');
  logger.log('worker iniciado (consumo da fila ainda não implementado)');

  // Mantém o processo vivo até o consumo da fila (papel B) substituir isto.
  setInterval(() => logger.debug('aguardando implementação do consumo da fila'), 60_000);
}

void bootstrap();
