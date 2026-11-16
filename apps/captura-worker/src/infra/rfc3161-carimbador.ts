import { Injectable, Logger } from '@nestjs/common';
import { CarimboTempo, ICarimbadorTempo } from '../dominio';

/** Codificação ASN.1 DER suficiente para TimeStampReq (RFC 3161). */
function der(tag: number, conteudo: Buffer): Buffer {
  if (conteudo.length < 128) return Buffer.concat([Buffer.from([tag, conteudo.length]), conteudo]);
  const hex = conteudo.length.toString(16).padStart(2, '0');
  const pares = hex.length % 2 ? '0' + hex : hex;
  const tamanho = Buffer.from(pares, 'hex');
  return Buffer.concat([Buffer.from([tag, 0x80 | tamanho.length]), tamanho, conteudo]);
}

type ElementoDer = { tag: number; valor: Buffer; fim: number };

function lerElemento(bytes: Buffer, inicio: number): ElementoDer {
  if (inicio + 2 > bytes.length) throw new Error('ASN.1 truncado');
  const tag = bytes[inicio];
  const byteTamanho = bytes[inicio + 1];
  let tamanho = byteTamanho;
  let pos = inicio + 2;
  if (byteTamanho & 0x80) {
    const quantidade = byteTamanho & 0x7f;
    if (!quantidade || quantidade > 4 || pos + quantidade > bytes.length) throw new Error('DER inválido');
    tamanho = 0;
    for (let i = 0; i < quantidade; i++) tamanho = tamanho * 256 + bytes[pos++];
  }
  if (pos + tamanho > bytes.length) throw new Error('Elemento DER incompleto');
  return { tag, valor: bytes.subarray(pos, pos + tamanho), fim: pos + tamanho };
}

function filhos(bytes: Buffer): ElementoDer[] {
  const resultado: ElementoDer[] = [];
  let pos = 0;
  while (pos < bytes.length) {
    const elemento = lerElemento(bytes, pos);
    resultado.push(elemento);
    pos = elemento.fim;
  }
  return resultado;
}

export function criarConsultaRfc3161(hashHex: string): Buffer {
  if (!/^[0-9a-f]{64}$/i.test(hashHex)) throw new Error('SHA-256 inválido');
  // AlgorithmIdentifier: SHA-256 OID 2.16.840.1.101.3.4.2.1 + NULL
  const algoritmo = Buffer.from('300d06096086480165030402010500', 'hex');
  const imprint = der(0x30, Buffer.concat([
    algoritmo,
    der(0x04, Buffer.from(hashHex, 'hex')),
  ]));
  return der(0x30, Buffer.concat([
    der(0x02, Buffer.from([1])),
    imprint,
    der(0x01, Buffer.from([0xff])), // certReq = TRUE
  ]));
}

function horarioGeneralizado(valor: Buffer): string {
  const texto = valor.toString('ascii');
  const partes = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.(\d+))?Z$/.exec(texto);
  if (!partes) throw new Error('Horário RFC 3161 inválido');
  const fracao = (partes[7] ?? '').padEnd(3, '0').slice(0, 3);
  const data = new Date(`${partes[1]}-${partes[2]}-${partes[3]}T${partes[4]}:${partes[5]}:${partes[6]}.${fracao}Z`);
  if (!Number.isFinite(data.getTime())) throw new Error('Data inválida no carimbo');
  return data.toISOString();
}

/**
 * Retira o CMS TimeStampToken do TimeStampResp e confere o messageImprint.
 * Não substitui a validação da cadeia de certificados e assinatura CMS por OpenSSL.
 */
export function interpretarRespostaRfc3161(resposta: Buffer, hashEsperado: string): { token: Buffer; horario: string } {
  const raiz = lerElemento(resposta, 0);
  if (raiz.tag !== 0x30 || raiz.fim !== resposta.length) throw new Error('TimeStampResp inválida');
  const partes = filhos(raiz.valor);
  const statusInfo = filhos(partes[0]?.valor ?? Buffer.alloc(0));
  const status = statusInfo[0];
  if (partes[0]?.tag !== 0x30 || status?.tag !== 0x02 || status.valor.length !== 1 ||
      ![0, 1].includes(status.valor[0]) || partes[1]?.tag !== 0x30) {
    throw new Error('FreeTSA não concedeu um token válido');
  }
  // Em vez de depender do cabeçalho DER de tamanho variável, reconstituímos o TLV.
  const tokenDer = der(0x30, partes[1].valor);
  const infoCms = filhos(partes[1].valor);
  if (infoCms.length < 2 || infoCms[1].tag !== 0xa0) throw new Error('CMS inválido');
  const signedData = filhos(infoCms[1].valor)[0];
  if (!signedData || signedData.tag !== 0x30) throw new Error('SignedData inválido');
  const partesSigned = filhos(signedData.valor);
  if (partesSigned.length < 3 || partesSigned[2].tag !== 0x30) throw new Error('CMS sem conteúdo');
  const encapsulado = filhos(partesSigned[2].valor);
  if (encapsulado.length < 2 || encapsulado[1].tag !== 0xa0) throw new Error('CMS sem TSTInfo');
  const octetos = filhos(encapsulado[1].valor)[0];
  if (!octetos || octetos.tag !== 0x04) throw new Error('Conteúdo do carimbo inválido');
  const tst = lerElemento(octetos.valor, 0);
  if (tst.tag !== 0x30) throw new Error('TSTInfo inválido');
  const partesTst = filhos(tst.valor);
  if (partesTst.length < 5 || partesTst[2].tag !== 0x30 || partesTst[4].tag !== 0x18) {
    throw new Error('TSTInfo incompleto');
  }
  const imprint = filhos(partesTst[2].valor);
  const algoritmo = imprint[0]?.tag === 0x30 ? filhos(imprint[0].valor)[0] : undefined;
  if (algoritmo?.tag !== 0x06 || algoritmo.valor.toString('hex') !== '608648016503040201' ||
      imprint.length < 2 || imprint[1].tag !== 0x04 ||
      imprint[1].valor.toString('hex') !== hashEsperado.toLowerCase()) {
    throw new Error('Carimbo não corresponde ao manifesto SHA-256');
  }
  return { token: tokenDer, horario: horarioGeneralizado(partesTst[4].valor) };
}

@Injectable()
export class Rfc3161Carimbador implements ICarimbadorTempo {
  private readonly logger = new Logger(Rfc3161Carimbador.name);

  async carimbar(hashSha256: string): Promise<CarimboTempo> {
    try {
      const url = process.env.TSA_URL ?? 'https://freetsa.org/tsr';
      const timeout = Number(process.env.TSA_TIMEOUT_MS ?? 8000);
      const consulta = criarConsultaRfc3161(hashSha256);
      const resposta = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/timestamp-query', accept: 'application/timestamp-reply' },
        body: new Uint8Array(consulta),
        signal: AbortSignal.timeout(Number.isFinite(timeout) && timeout > 0 ? timeout : 8000),
      });
      if (!resposta.ok) throw new Error(`TSA HTTP ${resposta.status}`);
      const bytes = Buffer.from(await resposta.arrayBuffer());
      const carimbo = interpretarRespostaRfc3161(bytes, hashSha256);
      return { fonte: 'FREETSA', horario: carimbo.horario, tokenBase64: carimbo.token.toString('base64') };
    } catch (erro) {
      this.logger.warn(`FreeTSA indisponível ou resposta inválida: ${erro instanceof Error ? erro.message : String(erro)}`);
      // Fallback contratual, explicitamente NÃO certificado.
      return { fonte: 'RELOGIO_LOCAL', horario: new Date().toISOString() };
    }
  }
}
