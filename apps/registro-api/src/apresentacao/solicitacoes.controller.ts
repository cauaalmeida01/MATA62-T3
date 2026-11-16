import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ConsultarSolicitacaoOutput,
  ConsultarSolicitacaoUseCase,
  CriarSolicitacaoOutput,
  CriarSolicitacaoUseCase,
} from '../aplicacao';
import { CriarSolicitacaoDto } from './criar-solicitacao.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsuarioAtual } from './usuario-atual.decorator';

@Controller('solicitacoes')
@UseGuards(JwtAuthGuard)
export class SolicitacoesController {
  constructor(
    private readonly criarSolicitacaoUseCase: CriarSolicitacaoUseCase,
    private readonly consultarSolicitacaoUseCase: ConsultarSolicitacaoUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async criar(
    @UsuarioAtual('id') userId: string,
    @Body() dto: CriarSolicitacaoDto,
  ): Promise<CriarSolicitacaoOutput> {
    return this.criarSolicitacaoUseCase.executar({
      userId,
      url: dto.url,
      titulo: dto.titulo,
      modo: dto.modo,
    });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async consultar(
    @UsuarioAtual('id') userIdAutenticado: string,
    @Param('id') solicitacaoId: string,
  ): Promise<ConsultarSolicitacaoOutput> {
    return this.consultarSolicitacaoUseCase.executar({
      solicitacaoId,
      userIdAutenticado,
    });
  }
}
