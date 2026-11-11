import { Controller, Get, Inject } from '@nestjs/common';

export const NOME_SERVICO = Symbol('NOME_SERVICO');

/** GET /api/health: usado no docker-compose e para saber se o serviço subiu. */
@Controller('health')
export class HealthController {
  constructor(@Inject(NOME_SERVICO) private readonly nomeServico: string) {}

  @Get()
  verificar() {
    return { status: 'ok', servico: this.nomeServico, horario: new Date().toISOString() };
  }
}
