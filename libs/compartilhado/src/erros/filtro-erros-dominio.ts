import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ErroDominio } from './erros-dominio';

/** Status HTTP de cada código de erro de domínio (docs/contratos.md, seção 5). */
const STATUS_POR_CODIGO: Record<string, number> = {
  NAO_ENCONTRADO: HttpStatus.NOT_FOUND,
  ACESSO_NEGADO: HttpStatus.FORBIDDEN,
  CONFLITO: HttpStatus.CONFLICT,
  REGRA_VIOLADA: HttpStatus.UNPROCESSABLE_ENTITY,
  CREDITOS_INSUFICIENTES: HttpStatus.PAYMENT_REQUIRED,
};

/** Converte qualquer erro no formato único de resposta de erro. */
@Catch()
export class FiltroErrosDominio implements ExceptionFilter {
  private readonly logger = new Logger(FiltroErrosDominio.name);

  catch(erro: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const resposta = ctx.getResponse<Response>();
    const requisicao = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let codigo = 'ERRO_INTERNO';
    let mensagem = 'Erro interno';

    if (erro instanceof ErroDominio) {
      status = STATUS_POR_CODIGO[erro.codigo] ?? HttpStatus.BAD_REQUEST;
      codigo = erro.codigo;
      mensagem = erro.message;
    } else if (erro instanceof HttpException) {
      status = erro.getStatus();
      codigo = status === HttpStatus.BAD_REQUEST ? 'DADOS_INVALIDOS' : `HTTP_${status}`;
      const corpo = erro.getResponse();
      mensagem = typeof corpo === 'string' ? corpo : JSON.stringify((corpo as { message?: unknown }).message ?? corpo);
    } else {
      this.logger.error(erro);
    }

    resposta.status(status).json({
      erro: { codigo, mensagem },
      caminho: requisicao.url,
      horario: new Date().toISOString(),
    });
  }
}
