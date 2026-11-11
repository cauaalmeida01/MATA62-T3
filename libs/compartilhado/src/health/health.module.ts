import { DynamicModule, Module } from '@nestjs/common';
import { HealthController, NOME_SERVICO } from './health.controller';

@Module({})
export class HealthModule {
  static para(nomeServico: string): DynamicModule {
    return {
      module: HealthModule,
      controllers: [HealthController],
      providers: [{ provide: NOME_SERVICO, useValue: nomeServico }],
    };
  }
}
