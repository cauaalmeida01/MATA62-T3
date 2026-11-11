import { Logger, Type, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FiltroErrosDominio } from './erros/filtro-erros-dominio';

/**
 * Sobe um serviço HTTP com a mesma configuração em todos:
 * prefixo /api, validação dos DTOs e o formato de erro de docs/contratos.md.
 */
export async function iniciarApi(modulo: Type<unknown>, nomeServico: string): Promise<void> {
  const app = await NestFactory.create(modulo);
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new FiltroErrosDominio());

  const porta = Number(process.env.PORT ?? 3000);
  await app.listen(porta);
  new Logger(nomeServico).log(`ouvindo na porta ${porta}`);
}
