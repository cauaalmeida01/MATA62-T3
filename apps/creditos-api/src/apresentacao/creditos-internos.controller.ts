import { Body, Controller, HttpCode, HttpStatus, Logger, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import {
  CriarCarteiraUseCase,
  EfetivarReservaUseCase,
  EncerrarReservaOutput,
  LiberarReservaUseCase,
  ReservarCreditoUseCase,
} from '../aplicacao';
import { CriarCarteiraDto, EncerrarReservaDto, ReservarCreditoDto } from './dtos';

/**
 * Rotas internas (docs/contratos.md, seção 3). Só os outros serviços chamam,
 * pela rede do Docker; o Nginx devolve 404 para /api/internal.
 * O controller só traduz HTTP <-> caso de uso; a regra fica na aplicação e no domínio.
 */
@Controller('internal')
export class CreditosInternosController {
  private readonly logger = new Logger(CreditosInternosController.name);

  constructor(
    private readonly criarCarteira: CriarCarteiraUseCase,
    private readonly reservarCredito: ReservarCreditoUseCase,
    private readonly efetivarReserva: EfetivarReservaUseCase,
    private readonly liberarReserva: LiberarReservaUseCase,
  ) {}

  /** 201 quando cria; 200 quando a carteira já existia (chamada repetida). */
  @Post('carteiras')
  async carteiras(@Body() dto: CriarCarteiraDto, @Res({ passthrough: true }) res: Response) {
    const { criada, ...saldo } = await this.criarCarteira.executar(dto.userId);
    res.status(criada ? HttpStatus.CREATED : HttpStatus.OK);
    return { userId: dto.userId, ...saldo };
  }

  @Post('reservas')
  @HttpCode(HttpStatus.CREATED)
  reservas(@Body() dto: ReservarCreditoDto): Promise<{ reservaId: string }> {
    return this.reservarCredito.executar(dto);
  }

  @Post('reservas/:id/efetivar')
  @HttpCode(HttpStatus.OK)
  efetivar(@Param('id') reservaId: string): Promise<EncerrarReservaOutput> {
    return this.efetivarReserva.executar(reservaId);
  }

  @Post('reservas/:id/liberar')
  @HttpCode(HttpStatus.OK)
  liberar(@Param('id') reservaId: string, @Body() dto: EncerrarReservaDto): Promise<EncerrarReservaOutput> {
    if (dto.motivo) this.logger.log(`Liberando reserva ${reservaId}: ${dto.motivo}`);
    return this.liberarReserva.executar(reservaId);
  }
}
