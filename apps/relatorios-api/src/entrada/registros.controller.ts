import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ConcluirRegistro } from '../aplicacao/concluir-registro';
import { DetalharRegistro, ListarRegistros } from '../aplicacao/consultar-registros';
import { DadosRegistro } from '../dominio/registro';
import { AutenticacaoGuard, Usuario, UsuarioAutenticado } from './autenticacao.guard';
import { ConclusaoDto } from './conclusao.dto';

/**
 * Camada de entrada: só traduz HTTP <-> casos de uso (SRP).
 * Nenhuma regra de negócio aqui; os erros de domínio viram HTTP no filtro comum.
 */

/** Rotas públicas (passam pelo Nginx): REQ12 e REQ13. */
@Controller('registros')
@UseGuards(AutenticacaoGuard)
export class RegistrosController {
  constructor(
    private readonly listar: ListarRegistros,
    private readonly detalhar: DetalharRegistro,
  ) {}

  @Get()
  async listarDoUsuario(@Usuario() usuario: UsuarioAutenticado) {
    const registros = await this.listar.executar(usuario.id);
    return registros.map(resumo);
  }

  @Get(':id')
  async detalhe(@Param('id') id: string, @Usuario() usuario: UsuarioAutenticado) {
    return detalhe(await this.detalhar.executar(id, usuario.id));
  }
}

/** Rota interna (só entre serviços; o Nginx não expõe /api/internal): REQ11. */
@Controller('internal/registros')
export class ConclusaoController {
  constructor(private readonly concluir: ConcluirRegistro) {}

  @Post(':solicitacaoId/conclusao')
  @HttpCode(201)
  async concluirRegistro(
    @Param('solicitacaoId', new ParseUUIDPipe()) solicitacaoId: string,
    @Body() corpo: ConclusaoDto,
    @Res({ passthrough: true }) resposta: Response,
  ) {
    const resultado = await this.concluir.executar({
      solicitacaoId,
      userId: corpo.userId,
      reservaId: corpo.reservaId,
      url: corpo.url,
      titulo: corpo.titulo,
      inicio: new Date(corpo.inicio),
      fim: new Date(corpo.fim),
      evidenciaId: corpo.pacote.evidenciaId,
      manifestoSha256: corpo.pacote.manifestoSha256,
      carimbo: { fonte: corpo.pacote.carimbo.fonte, horario: new Date(corpo.pacote.carimbo.horario) },
      arquivos: corpo.pacote.arquivos.map((a) => ({ ...a })),
    });
    // Contrato: 201 quando cria; 200 com o mesmo registroId quando a chamada é repetida.
    if (!resultado.criado) resposta.status(200);
    return { registroId: resultado.registroId };
  }
}

function resumo(r: DadosRegistro) {
  return {
    id: r.id,
    url: r.url,
    titulo: r.titulo,
    inicio: r.inicio.toISOString(),
    fim: r.fim.toISOString(),
    carimbo: { fonte: r.carimbo.fonte, horario: r.carimbo.horario.toISOString() },
    criadoEm: r.criadoEm.toISOString(),
  };
}

function detalhe(r: DadosRegistro) {
  return {
    ...resumo(r),
    solicitacaoId: r.solicitacaoId,
    evidenciaId: r.evidenciaId,
    manifestoSha256: r.manifestoSha256,
    arquivos: r.arquivos.map((a) => ({ nome: a.nome, tipo: a.tipo, sha256: a.sha256, tamanhoBytes: a.tamanhoBytes })),
  };
}
