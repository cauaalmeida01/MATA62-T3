import { Body, Controller, Delete, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, UsuarioAtual, UsuarioAutenticado } from '@app/compartilhado';
import {
  CadastrarUsuarioUseCase,
  LogarUseCase,
  SairUseCase,
  SessaoOutput,
  UsuarioCadastradoOutput,
} from '../aplicacao';
import { CadastrarUsuarioDto, LogarDto } from './dtos';

/** Rotas públicas da contas-api (docs/contratos.md, seção 2). */
@Controller()
export class ContasController {
  constructor(
    private readonly cadastrar: CadastrarUsuarioUseCase,
    private readonly logar: LogarUseCase,
    private readonly sair: SairUseCase,
  ) {}

  /** REQ01 */
  @Post('contas')
  @HttpCode(HttpStatus.CREATED)
  cadastro(@Body() dto: CadastrarUsuarioDto): Promise<UsuarioCadastradoOutput> {
    return this.cadastrar.executar(dto);
  }

  /** REQ03 */
  @Post('sessoes')
  @HttpCode(HttpStatus.CREATED)
  login(@Body() dto: LogarDto): Promise<SessaoOutput> {
    return this.logar.executar(dto);
  }

  /** REQ04: precisa do token, porque é ele que será revogado. */
  @Delete('sessoes/atual')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<void> {
    await this.sair.executar(usuario);
  }
}
