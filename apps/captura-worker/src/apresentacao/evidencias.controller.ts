import { timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AcessoNegado } from '@app/compartilhado';
import { MetadadosEvidencia } from '../dominio';
import { SelarEvidenciaUseCase } from '../aplicacao/selar-evidencia.use-case';

interface ArquivoMultipart {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

@Controller('internal/evidencias')
export class EvidenciasController {
  constructor(private readonly selar: SelarEvidenciaUseCase) {}

  @Post()
  @UseInterceptors(FilesInterceptor('arquivos', 10, {
    limits: { files: 10, fileSize: 25 * 1024 * 1024, fieldSize: 64 * 1024 },
  }))
  async criar(
    @Headers('x-internal-api-key') chaveRecebida: string | undefined,
    @Body('metadados') metadadosJson: string,
    @UploadedFiles() arquivos: ArquivoMultipart[],
  ) {
    const chaveCorreta = process.env.EVIDENCIA_INTERNAL_KEY;
    if (!chaveCorreta) throw new Error('EVIDENCIA_INTERNAL_KEY não configurada');
    const recebido = Buffer.from(chaveRecebida ?? '', 'utf8');
    const esperado = Buffer.from(chaveCorreta, 'utf8');
    if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) {
      throw new AcessoNegado('Acesso interno não autorizado');
    }
    if (typeof metadadosJson !== 'string') {
      throw new BadRequestException('Campo metadados em JSON é obrigatório');
    }
    let metadados: MetadadosEvidencia;
    try {
      const parsed: unknown = JSON.parse(metadadosJson);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON inválido');
      metadados = parsed as MetadadosEvidencia;
    } catch {
      throw new BadRequestException('Campo metadados deve conter um objeto JSON válido');
    }
    return this.selar.executar(metadados, (arquivos ?? []).map((arquivo) => ({
      nome: arquivo.originalname,
      mimeType: arquivo.mimetype,
      conteudo: arquivo.buffer,
    })));
  }
}
