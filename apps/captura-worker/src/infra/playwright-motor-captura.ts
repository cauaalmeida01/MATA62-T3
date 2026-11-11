import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inject, Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { Browser, BrowserContext, chromium } from 'playwright';
import {
  FalhaCapturaError,
  IMotorCaptura,
  IValidadorUrlSegura,
  OpcoesCaptura,
  ResultadoCaptura,
  VALIDADOR_URL_SEGURA_WORKER,
} from '../dominio';

const VIEWPORT_PADRAO = { width: 1366, height: 768 };
const USER_AGENT_PADRAO =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) VeriditBot/1.0 Chrome/131.0.0.0 Safari/537.36';

@Injectable()
export class PlaywrightMotorCaptura implements IMotorCaptura, OnModuleDestroy {
  private readonly logger = new Logger(PlaywrightMotorCaptura.name);
  private browser: Browser | null = null;
  private readonly timeoutMs: number;

  constructor(
    @Optional()
    @Inject(VALIDADOR_URL_SEGURA_WORKER)
    private readonly validadorUrlSegura?: IValidadorUrlSegura,
  ) {
    this.timeoutMs = Number(process.env.CAPTURA_TIMEOUT_MS ?? 30_000);
  }

  async capturar(opcoes: OpcoesCaptura): Promise<ResultadoCaptura> {
    const inicio = new Date();
    const pastaTemporaria = await fs.mkdtemp(
      join(tmpdir(), `veridit-captura-${opcoes.solicitacaoId}-`),
    );
    const caminhoHar = join(pastaTemporaria, 'rede.har');

    let contexto: BrowserContext | null = null;

    try {
      const browser = await this.obterBrowser();

      // Contexto limpo e isolado por sessão (cookies, storage e cache zerados)
      contexto = await browser.newContext({
        viewport: VIEWPORT_PADRAO,
        userAgent: USER_AGENT_PADRAO,
        ignoreHTTPSErrors: false,
        recordHar: {
          path: caminhoHar,
          mode: 'minimal',
        },
      });

      // Intercepta sub-requisições para impedir redirecionamentos ou sub-recursos SSRF
      if (this.validadorUrlSegura) {
        const validador = this.validadorUrlSegura;
        await contexto.route('**/*', async (rota) => {
          const urlRequisicao = rota.request().url();
          if (urlRequisicao.startsWith('data:') || urlRequisicao.startsWith('blob:')) {
            await rota.continue();
            return;
          }
          try {
            await validador.validar(urlRequisicao);
            await rota.continue();
          } catch (erro) {
            this.logger.warn(`Sub-requisição bloqueada por anti-SSRF: ${urlRequisicao}`);
            await rota.abort('accessdenied');
            if (rota.request().isNavigationRequest() && rota.request().frame() === rota.request().frame()?.page().mainFrame()) {
              throw erro;
            }
          }
        });
      }

      const pagina = await contexto.newPage();
      const resposta = await pagina.goto(opcoes.url, {
        waitUntil: 'networkidle',
        timeout: this.timeoutMs,
      });

      const statusHttp = resposta ? resposta.status() : null;
      const urlFinal = pagina.url();

      if (this.validadorUrlSegura) {
        await this.validadorUrlSegura.validar(urlFinal);
      }

      const screenshotBuffer = await pagina.screenshot({
        fullPage: true,
        type: 'png',
      });

      // Fecha o contexto para garantir que o Playwright grave o arquivo HAR completo no disco
      await contexto.close();
      contexto = null;

      let harBuffer: Buffer;
      try {
        harBuffer = await fs.readFile(caminhoHar);
      } catch {
        harBuffer = Buffer.from(
          JSON.stringify({
            log: {
              version: '1.2',
              creator: { name: 'Veridit-Playwright', version: '1.0' },
              entries: [],
            },
          }),
          'utf8',
        );
      }

      const fim = new Date();

      return {
        inicio,
        fim,
        urlFinal,
        statusHttp,
        userAgent: USER_AGENT_PADRAO,
        viewport: VIEWPORT_PADRAO,
        arquivos: [
          {
            nome: 'screenshot.png',
            tipo: 'TELA',
            mimeType: 'image/png',
            conteudo: screenshotBuffer,
          },
          {
            nome: 'rede.har',
            tipo: 'HAR',
            mimeType: 'application/json',
            conteudo: harBuffer,
          },
        ],
      };
    } catch (erro) {
      if (erro instanceof Error && erro.name === 'UrlInvalidaOuBloqueadaWorkerError') {
        throw erro;
      }
      const detalhe = erro instanceof Error ? erro.message : String(erro);
      throw new FalhaCapturaError(`Falha na captura Playwright para ${opcoes.url}: ${detalhe}`);
    } finally {
      if (contexto) {
        await contexto.close().catch(() => undefined);
      }
      await fs.rm(pastaTemporaria, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async obterBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    return this.browser;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }
  }
}
