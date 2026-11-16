import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, UsuarioAtual } from '@app/compartilhado';
import { ConsultarSaldoUseCase, SaldoOutput } from '../aplicacao';

/** Rota pública (passa pelo Nginx): o usuário só vê a própria carteira, pelo id do token. */
@Controller('creditos')
@UseGuards(JwtAuthGuard)
export class CreditosController {
  constructor(private readonly consultarSaldo: ConsultarSaldoUseCase) {}

  @Get('saldo')
  saldo(@UsuarioAtual('id') userId: string): Promise<SaldoOutput> {
    return this.consultarSaldo.executar(userId);
  }
}
