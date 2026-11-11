import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  FalhaCapturaError,
  IMotorCaptura,
  IValidadorUrlSegura,
  OpcoesCaptura,
  ResultadoCaptura,
  VALIDADOR_URL_SEGURA_WORKER,
} from '../dominio';

// PNG 1x1 transparente válido (68 bytes) para representação visual determinística no modo HTTP simples
const PNG_MINIMO_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const VIEWPORT_HTTP = { width: 1366, height: 768 };
const USER_AGENT_HTTP = 'VeriditHttpMotorCaptura/1.0';

/**
 * Implementação alternativa de `IMotorCaptura` via HTTP/fetch (OCP e LSP).
 * Permite trocar o motor de captura via `MOTOR_CAPTURA=http` sem alterar casos de uso.
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
                size: Buffer.byteLength(corpoTexto, 'utf8'),
                mimeType: resposta.headers.get('content-type') ?? 'text/html',
                text: corpoTexto,
              },
              redirectURL: '',
              headersSize: -1,
              bodySize: Buffer.byteLength(corpoTexto, 'utf8'),
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
          nome: 'screenshot.png',
          tipo: 'TELA',
          mimeType: 'image/png',
          conteudo: Buffer.from(PNG_MINIMO_BASE64, 'base64'),
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
