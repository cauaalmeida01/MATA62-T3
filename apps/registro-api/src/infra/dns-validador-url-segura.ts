import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { Injectable } from '@nestjs/common';
import { IValidadorUrlSegura, UrlInvalidaOuBloqueadaError } from '../dominio';

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

export type FuncaoLookupDns = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

const lookupPadrao: FuncaoLookupDns = (hostname) => dns.lookup(hostname, { all: true });

@Injectable()
export class DnsValidadorUrlSegura implements IValidadorUrlSegura {
  private readonly lookupDns: FuncaoLookupDns;

  constructor(lookupCustomizado?: FuncaoLookupDns) {
    this.lookupDns = lookupCustomizado ?? lookupPadrao;
  }

  async validar(urlBruta: string): Promise<void> {
    let url: URL;
    try {
      url = new URL(urlBruta);
    } catch {
      throw new UrlInvalidaOuBloqueadaError('Formato de URL inválido');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new UrlInvalidaOuBloqueadaError(
        `Protocolo "${url.protocol}" não permitido; use http: ou https:`,
      );
    }

    if (url.username || url.password) {
      throw new UrlInvalidaOuBloqueadaError('URL não pode conter credenciais de autenticação');
    }

    const hostnameLimpo = url.hostname
      .replace(/^\[|\]$/g, '')
      .replace(/\.$/, '')
      .toLowerCase();

    if (!hostnameLimpo) {
      throw new UrlInvalidaOuBloqueadaError('Hostname ausente na URL');
    }

    if (
      HOSTS_INTERNOS_BLOQUEADOS.has(hostnameLimpo) ||
      hostnameLimpo.endsWith('.local') ||
      hostnameLimpo.endsWith('.internal')
    ) {
      throw new UrlInvalidaOuBloqueadaError(
        `Host "${hostnameLimpo}" bloqueado pela política anti-SSRF`,
      );
    }

    // Se o hostname já for um literal IPv4 ou IPv6, valida diretamente
    const familiaIpLiteral = isIP(hostnameLimpo);
    if (familiaIpLiteral !== 0) {
      this.garantirIpPublico(hostnameLimpo);
      return;
    }

    let enderecos: Array<{ address: string; family: number }>;
    try {
      enderecos = await this.lookupDns(hostnameLimpo);
    } catch {
      throw new UrlInvalidaOuBloqueadaError(
        `Não foi possível resolver o domínio "${hostnameLimpo}"`,
      );
    }

    if (!enderecos || enderecos.length === 0) {
      throw new UrlInvalidaOuBloqueadaError(
        `Nenhum endereço IP encontrado para o domínio "${hostnameLimpo}"`,
      );
    }

    for (const entrada of enderecos) {
      this.garantirIpPublico(entrada.address);
    }
  }

  private garantirIpPublico(endereco: string): void {
    const ipNormalizado = endereco.replace(/^\[|\]$/g, '').toLowerCase();
    if (ehIpPrivadoOuReservado(ipNormalizado)) {
      throw new UrlInvalidaOuBloqueadaError(
        'Endereço de destino resolve para rede interna ou reservada (bloqueio anti-SSRF)',
      );
    }
  }
}

export function ehIpPrivadoOuReservado(ip: string): boolean {
  const familia = isIP(ip);
  if (familia === 4) {
    return ehIpv4PrivadoOuReservado(ip);
  }
  if (familia === 6) {
    return ehIpv6PrivadoOuReservado(ip);
  }
  return true;
}

function ehIpv4PrivadoOuReservado(ip: string): boolean {
  const partes = ip.split('.').map((p) => Number(p));
  if (partes.length !== 4 || partes.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }

  const [a, b] = partes;

  // 0.0.0.0/8 (rede atual / não especificado)
  if (a === 0) return true;
  // 10.0.0.0/8 (privado classe A)
  if (a === 10) return true;
  // 100.64.0.0/10 (CGNAT RFC 6598)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local / metadata cloud 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (privado 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (privado classe C)
  if (a === 192 && b === 168) return true;
  // 224.0.0.0/4 (multicast) e 240.0.0.0/4 (reservado / broadcast)
  if (a >= 224) return true;

  return false;
}

function ehIpv6PrivadoOuReservado(ip: string): boolean {
  const semZona = ip.split('%')[0].toLowerCase();

  if (semZona === '::1' || semZona === '::' || semZona === '0:0:0:0:0:0:0:1' || semZona === '0:0:0:0:0:0:0:0') {
    return true;
  }

  // IPv4 mapeado em IPv6 no formato decimal (ex: ::ffff:127.0.0.1)
  if (semZona.startsWith('::ffff:')) {
    const sufixo = semZona.slice('::ffff:'.length);
    if (isIP(sufixo) === 4) {
      return ehIpv4PrivadoOuReservado(sufixo);
    }
    // Formato hexadecimal (ex: ::ffff:7f00:1)
    const partesHex = sufixo.split(':');
    if (partesHex.length === 2) {
      const alto = parseInt(partesHex[0], 16);
      const baixo = parseInt(partesHex[1], 16);
      if (!Number.isNaN(alto) && !Number.isNaN(baixo)) {
        const ipv4 = `${(alto >> 8) & 0xff}.${alto & 0xff}.${(baixo >> 8) & 0xff}.${baixo & 0xff}`;
        return ehIpv4PrivadoOuReservado(ipv4);
      }
    }
  }

  const primeiroHextetoTexto = semZona.split(':').find((bloco) => bloco.length > 0) ?? '0';
  const primeiroHexteto = parseInt(primeiroHextetoTexto, 16);
  if (Number.isNaN(primeiroHexteto)) {
    return true;
  }

  // fc00::/7 (Unique Local Address: fc00..fdff)
  if ((primeiroHexteto & 0xfe00) === 0xfc00) {
    return true;
  }

  // fe80::/10 (Link-local: fe80..febf)
  if ((primeiroHexteto & 0xffc0) === 0xfe80) {
    return true;
  }

  // ff00::/8 (Multicast)
  if ((primeiroHexteto & 0xff00) === 0xff00) {
    return true;
  }

  return false;
}
