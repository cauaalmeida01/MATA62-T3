import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Conflito, RegraDeNegocioViolada } from '@app/compartilhado';
import {
  ARMAZENAMENTO_EVIDENCIA,
  CARIMBADOR_TEMPO,
  EVIDENCIA_REPOSITORY,
  ArquivoRecebido,
  ArquivoSelado,
  IArmazenamentoEvidencia,
  ICarimbadorTempo,
  IEvidenciaRepository,
  MetadadosEvidencia,
  PacoteSelado,
  TipoArquivo,
} from '../dominio';

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TAMANHO_MAXIMO = 25 * 1024 * 1024;
const MAX_ARQUIVOS = 10;

export function hashSha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function tipoPorArquivo(nome: string, mime: string): TipoArquivo {
  const tipos: { [extensao: string]: { tipo: TipoArquivo; mimes: string[] } } = {
    '.png': { tipo: 'TELA', mimes: ['image/png'] },
    '.har': { tipo: 'HAR', mimes: ['application/json', 'application/octet-stream'] },
    '.html': { tipo: 'HTML', mimes: ['text/html', 'application/octet-stream'] },
  };
  const extensao = nome.slice(nome.lastIndexOf('.')).toLowerCase();
  const permitido = tipos[extensao];
  if (!permitido || !permitido.mimes.includes(mime.toLowerCase().split(';')[0].trim())) {
    throw new RegraDeNegocioViolada(`Arquivo não permitido: ${nome} (${mime})`);
  }
  return permitido.tipo;
}

/** O mesmo manifesto, independentemente da ordem dos arquivos recebidos. */
export function serializarManifesto(metadados: MetadadosEvidencia, arquivos: ArquivoSelado[]): string {
  return JSON.stringify({
    versao: 1,
    solicitacaoId: metadados.solicitacaoId,
    userId: metadados.userId,
    url: metadados.url,
    inicio: metadados.inicio,
    fim: metadados.fim,
    arquivos: [...arquivos].sort((a, b) => a.nome.localeCompare(b.nome, 'en')),
  });
}

@Injectable()
export class SelarEvidenciaUseCase {
  constructor(
    @Inject(EVIDENCIA_REPOSITORY) private readonly repositorio: IEvidenciaRepository,
    @Inject(ARMAZENAMENTO_EVIDENCIA) private readonly armazenamento: IArmazenamentoEvidencia,
    @Inject(CARIMBADOR_TEMPO) private readonly carimbador: ICarimbadorTempo,
  ) {}

  async executar(metadados: MetadadosEvidencia, arquivos: ArquivoRecebido[]): Promise<PacoteSelado> {
    this.validar(metadados, arquivos);

    // O worker pode receber novamente a mensagem: não selar uma segunda evidência.
    const existente = await this.repositorio.buscarPorSolicitacao(metadados.solicitacaoId);
    if (existente) {
      if (existente.userId !== metadados.userId) {
        throw new Conflito('A solicitação pertence a outro usuário');
      }
      return existente.pacote;
    }

    const evidenciaId = randomUUID();
    const itens: ArquivoSelado[] = arquivos.map((arquivo) => ({
      nome: arquivo.nome,
      tipo: tipoPorArquivo(arquivo.nome, arquivo.mimeType),
      sha256: hashSha256(arquivo.conteudo),
      tamanhoBytes: arquivo.conteudo.length,
      chave: `evidencias/${evidenciaId}/${arquivo.nome}`,
    }));
    const manifesto = serializarManifesto(metadados, itens);
    const manifestoSha256 = hashSha256(manifesto);
    const carimbo = await this.carimbador.carimbar(manifestoSha256);

    // Primeiro armazenar tudo; persistir o pacote apenas depois dos PUTs bem-sucedidos.
    for (let i = 0; i < arquivos.length; i++) {
      await this.armazenamento.gravar(itens[i].chave, arquivos[i].conteudo, arquivos[i].mimeType);
    }
    await this.armazenamento.gravar(
      `evidencias/${evidenciaId}/manifesto.json`,
      Buffer.from(manifesto, 'utf8'),
      'application/json',
    );
    if (carimbo.tokenBase64) {
      await this.armazenamento.gravar(
        `evidencias/${evidenciaId}/carimbo.tst`,
        Buffer.from(carimbo.tokenBase64, 'base64'),
        'application/timestamp-token',
      );
    }

    const pacote: PacoteSelado = { evidenciaId, manifestoSha256, carimbo, arquivos: itens };
    const resultado = await this.repositorio.salvar({ metadados, pacote });
    if (resultado.userId !== metadados.userId) {
      throw new Conflito('A solicitação pertence a outro usuário');
    }
    return resultado.pacote;
  }

  private validar(dados: MetadadosEvidencia, arquivos: ArquivoRecebido[]): void {
    if (!dados || !REGEX_UUID.test(dados.solicitacaoId ?? '') || !REGEX_UUID.test(dados.userId ?? '')) {
      throw new RegraDeNegocioViolada('solicitacaoId e userId devem ser UUIDs válidos');
    }
    if (typeof dados.url !== 'string' || dados.url.length > 2048) {
      throw new RegraDeNegocioViolada('URL inválida');
    }
    try {
      const url = new URL(dados.url);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new Error();
    } catch {
      throw new RegraDeNegocioViolada('URL inválida');
    }
    const inicio = Date.parse(dados.inicio ?? '');
    const fim = Date.parse(dados.fim ?? '');
    if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim < inicio) {
      throw new RegraDeNegocioViolada('Datas de início e fim inválidas');
    }
    if (!Array.isArray(arquivos) || arquivos.length === 0 || arquivos.length > MAX_ARQUIVOS) {
      throw new RegraDeNegocioViolada('Quantidade de arquivos inválida');
    }
    const nomes = new Set<string>();
    for (const arquivo of arquivos) {
      if (!arquivo || typeof arquivo.nome !== 'string' ||
          !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(arquivo.nome) ||
          arquivo.nome.includes('..') || nomes.has(arquivo.nome.toLowerCase()) ||
          !Buffer.isBuffer(arquivo.conteudo) || arquivo.conteudo.length === 0 ||
          arquivo.conteudo.length > TAMANHO_MAXIMO) {
        throw new RegraDeNegocioViolada('Arquivo inválido, duplicado, vazio ou acima do limite');
      }
      tipoPorArquivo(arquivo.nome, arquivo.mimeType);
      nomes.add(arquivo.nome.toLowerCase());
    }
  }
}
