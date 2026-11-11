import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { Injectable } from '@nestjs/common';
import { IValidadorUrlSegura, UrlInvalidaOuBloqueadaWorkerError } from '../dominio';

const HOSTS_INTERNOS_BLOQUEADOS = new Set([
  'localhost',
  'postgres',
  'elasticmq',
  'rustfs',
  'mailpit',
  'contas-api',
  'creditos-api',
  'registro-api',
  'evidencia-api',
  'relatorios-api',
  'captura-worker',
  'nginx',
  's3-init',
  'host.docker.internal',
]);

export type FuncaoLookupDnsWorker = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

const lookupPadrao: FuncaoLookupDnsWorker = (hostname) => dns.lookup(hostname, { all: true });

@Injectable()
export class DnsValidadorUrlSeguraWorker implements IValidadorUrlSegura {
  private readonly lookupDns: FuncaoLookupDnsWorker;

  constructor(lookupCustomizado?: FuncaoLookupDnsWorker) {
    this.lookupDns = lookupCustomizado ?? lookupPadrao;
  }

  async validar(urlBruta: string): Promise<void> {
    let url: URL;
    try {
      url = new URL(urlBruta);
    } catch {
      throw new UrlInvalidaOuBloqueadaWorkerError('Formato de URL inválido');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new UrlInvalidaOuBloqueadaWorkerError(
        `Protocolo "${url.protocol}" não permitido; apenas http: e https: são aceitos`,
      );
    }

    if (url.username || url.password) {
      throw new UrlInvalidaOuBloqueadaWorkerError(
        'URL não pode conter credenciais de autenticação',
      );
    }

    const hostnameLimpo = url.hostname
      .replace(/^\[|\]$/g, '')
      .replace(/\.$/, '')
      .toLowerCase();

    if (!hostnameLimpo) {
      throw new UrlInvalidaOuBloqueadaWorkerError('Hostname ausente na URL');
    }

    if (
      HOSTS_INTERNOS_BLOQUEADOS.has(hostnameLimpo) ||
      hostnameLimpo.endsWith('.local') ||
      hostnameLimpo.endsWith('.internal')
    ) {
      throw new UrlInvalidaOuBloqueadaWorkerError(
        `Host interno "${hostnameLimpo}" bloqueado pela política anti-SSRF`,
      );
    }

    if (isIP(hostnameLimpo) !== 0) {
      this.garantirIpPublico(hostnameLimpo);
      return;
    }

    let enderecos: Array<{ address: string; family: number }>;
    try {
      enderecos = await this.lookupDns(hostnameLimpo);
    } catch {
      throw new UrlInvalidaOuBloqueadaWorkerError(
        `Não foi possível resolver DNS para "${hostnameLimpo}"`,
      );
    }

    if (!enderecos || enderecos.length === 0) {
      throw new UrlInvalidaOuBloqueadaWorkerError(
        `Nenhum endereço IP encontrado para "${hostnameLimpo}"`,
      );
    }

    for (const entrada of enderecos) {
      this.garantirIpPublico(entrada.address);
    }
  }

  private garantirIpPublico(ip: string): void {
    const ipNormalizado = ip.replace(/^\[|\]$/g, '').toLowerCase();
    if (ehIpPrivadoOuReservadoWorker(ipNormalizado)) {
      throw new UrlInvalidaOuBloqueadaWorkerError(
        'Endereço IP resolvido pertence a faixa privada ou reservada (bloqueio anti-SSRF)',
      );
    }
  }
}

export function ehIpPrivadoOuReservadoWorker(ip: string): boolean {
  const familia = isIP(ip);
  if (familia === 4) {
    const partes = ip.split('.').map((p) => Number(p));
    if (partes.length !== 4 || partes.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = partes;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }

  if (familia === 6) {
    const semZona = ip.split('%')[0].toLowerCase();
    if (
      semZona === '::1' ||
      semZona === '::' ||
      semZona === '0:0:0:0:0:0:0:1' ||
      semZona === '0:0:0:0:0:0:0:0'
    ) {
      return true;
    }
    if (semZona.startsWith('::ffff:')) {
      const sufixo = semZona.slice('::ffff:'.length);
      if (isIP(sufixo) === 4) {
        return ehIpPrivadoOuReservadoWorker(sufixo);
      }
      const partesHex = sufixo.split(':');
      if (partesHex.length === 2) {
        const alto = parseInt(partesHex[0], 16);
        const baixo = parseInt(partesHex[1], 16);
        if (!Number.isNaN(alto) && !Number.isNaN(baixo)) {
          return ehIpPrivadoOuReservadoWorker(
            `${(alto >> 8) & 0xff}.${alto & 0xff}.${(baixo >> 8) & 0xff}.${baixo & 0xff}`,
          );
        }
      }
    }
    const primeiroHexteto = parseInt(
      semZona.split(':').find((bloco) => bloco.length > 0) ?? '0',
      16,
    );
    if (Number.isNaN(primeiroHexteto)) return true;
    if ((primeiroHexteto & 0xfe00) === 0xfc00) return true;
    if ((primeiroHexteto & 0xffc0) === 0xfe80) return true;
    if ((primeiroHexteto & 0xff00) === 0xff00) return true;
    return false;
  }

  return true;
}
