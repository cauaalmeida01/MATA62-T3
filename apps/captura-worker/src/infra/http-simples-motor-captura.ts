import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  FalhaCapturaError,
  IMotorCaptura,
  IValidadorUrlSegura,
  OpcoesCaptura,
  ResultadoCaptura,
  VALIDADOR_URL_SEGURA_WORKER,
} from '../dominio';

const VIEWPORT_HTTP = { width: 1366, height: 768 };
const USER_AGENT_HTTP = 'VeriditHttpMotorCaptura/1.0';

/**
 * Implementação alternativa de `IMotorCaptura` via HTTP/fetch (OCP e LSP).
 * Realiza o fetch real da URL e devolve o corpo da resposta como `pagina.html`
 * (`tipo: 'HTML'`, `mimeType: 'text/html'`) acompanhado do registo `rede.har`,
 * sem gerar imagens falsas.
 */
@Injectable()
export class HttpSimplesMotorCaptura implements IMotorCaptura {
  constructor(
    @Optional()
    @Inject(VALIDADOR_URL_SEGURA_WORKER)
    private readonly validadorUrlSegura?: IValidadorUrlSegura,
  ) {}

  async capturar(opcoes: OpcoesCaptura): Promise<ResultadoCaptura> {
    const inicio = new Date();

    if (this.validadorUrlSegura) {
      await this.validadorUrlSegura.validar(opcoes.url);
    }

    let resposta: Response;
    let corpoTexto = '';
    try {
      resposta = await fetch(opcoes.url, {
        method: 'GET',
        headers: { 'user-agent': USER_AGENT_HTTP },
        redirect: 'follow',
      });

      if (this.validadorUrlSegura && resposta.url) {
        await this.validadorUrlSegura.validar(resposta.url);
      }

      corpoTexto = await resposta.text();
    } catch (erro) {
      if (erro instanceof Error && erro.name === 'UrlInvalidaOuBloqueadaWorkerError') {
        throw erro;
      }
      const detalhe = erro instanceof Error ? erro.message : String(erro);
      throw new FalhaCapturaError(`Falha na captura HTTP de ${opcoes.url}: ${detalhe}`);
    }

    const fim = new Date();
    const duracaoMs = Math.max(1, fim.getTime() - inicio.getTime());
    const bufferHtml = Buffer.from(corpoTexto, 'utf8');

    const harJson = {
      log: {
        version: '1.2',
        creator: { name: 'Veridit-HttpSimplesMotorCaptura', version: '1.0' },
        entries: [
          {
            startedDateTime: inicio.toISOString(),
            time: duracaoMs,
            request: {
              method: 'GET',
              url: opcoes.url,
              httpVersion: 'HTTP/1.1',
              headers: [{ name: 'User-Agent', value: USER_AGENT_HTTP }],
              queryString: [],
              cookies: [],
              headersSize: -1,
              bodySize: 0,
            },
            response: {
              status: resposta.status,
              statusText: resposta.statusText,
              httpVersion: 'HTTP/1.1',
              headers: Array.from(resposta.headers.entries()).map(([name, value]) => ({
                name,
                value,
              })),
              cookies: [],
              content: {
                size: bufferHtml.byteLength,
                mimeType: resposta.headers.get('content-type') ?? 'text/html',
                text: corpoTexto,
              },
              redirectURL: '',
              headersSize: -1,
              bodySize: bufferHtml.byteLength,
            },
            cache: {},
            timings: { send: 0, wait: duracaoMs, receive: 0 },
          },
        ],
      },
    };

    return {
      inicio,
      fim,
      urlFinal: resposta.url || opcoes.url,
      statusHttp: resposta.status,
      userAgent: USER_AGENT_HTTP,
      viewport: VIEWPORT_HTTP,
      arquivos: [
        {
          nome: 'pagina.html',
          tipo: 'HTML',
          mimeType: 'text/html',
          conteudo: bufferHtml,
        },
        {
          nome: 'rede.har',
          tipo: 'HAR',
          mimeType: 'application/json',
          conteudo: Buffer.from(JSON.stringify(harJson, null, 2), 'utf8'),
        },
      ],
    };
  }
}
