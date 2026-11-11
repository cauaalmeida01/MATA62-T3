import { Module } from '@nestjs/common';

/**
 * Serviço Registro e Captura (comp. 10 Captura, worker da fila).
 * Esqueleto: o consumidor da fila "captura" e o da "captura-dlq" entram aqui.
 */
@Module({})
export class WorkerModule {}
