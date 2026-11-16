import { createHash, createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { IArmazenamentoEvidencia } from '../dominio';

/** Cliente S3 PutObject com Signature V4, sem dependências novas no package-lock. */
function sha256(conteudo: Buffer | string): string {
  return createHash('sha256').update(conteudo).digest('hex');
}
function hmac(chave: Buffer | string, texto: string): Buffer {
  return createHmac('sha256', chave).update(texto).digest();
}

@Injectable()
export class S3ArmazenamentoAdapter implements IArmazenamentoEvidencia {
  async gravar(chave: string, conteudo: Buffer, mimeType: string): Promise<void> {
    const endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
    const region = process.env.S3_REGION ?? 'us-east-1';
    const bucket = process.env.S3_BUCKET_EVIDENCIAS ?? 'evidencias';
    const accessKey = process.env.S3_ACCESS_KEY;
    const secretKey = process.env.S3_SECRET_KEY;
    if (!accessKey || !secretKey) throw new Error('S3_ACCESS_KEY e S3_SECRET_KEY são obrigatórios');
    if (!/^[a-z0-9][a-z0-9.-]{2,62}$/i.test(bucket)) throw new Error('Bucket inválido');
    if (!chave.startsWith('evidencias/') || chave.includes('..') || chave.includes('//')) {
      throw new Error('Chave S3 inválida');
    }

    const url = new URL(endpoint);
    const prefixo = url.pathname.replace(/\/$/, '');
    const uri = `${prefixo}/${encodeURIComponent(bucket)}/${chave.split('/').map(encodeURIComponent).join('/')}`;
    url.pathname = uri;
    url.search = '';
    const instante = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const data = instante.slice(0, 8);
    const payloadHash = sha256(conteudo);
    // S3 Object Lock exige Content-MD5 (ou checksum equivalente) em PutObject.
    const contentMd5 = createHash('md5').update(conteudo).digest('base64');
    const headersAssinados = 'content-md5;host;x-amz-content-sha256;x-amz-date';
    const canonic = [
      'PUT', uri, '',
      `content-md5:${contentMd5}\nhost:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${instante}\n`,
      headersAssinados, payloadHash,
    ].join('\n');
    const escopo = `${data}/${region}/s3/aws4_request`;
    const textoAssinatura = `AWS4-HMAC-SHA256\n${instante}\n${escopo}\n${sha256(canonic)}`;
    const assinaturaKey = hmac(hmac(hmac(hmac('AWS4' + secretKey, data), region), 's3'), 'aws4_request');
    const assinatura = hmac(assinaturaKey, textoAssinatura).toString('hex');
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${escopo}, SignedHeaders=${headersAssinados}, Signature=${assinatura}`;

    const resposta = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        authorization,
        'content-md5': contentMd5,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': instante,
        'content-type': mimeType,
      },
      body: new Uint8Array(conteudo),
      signal: AbortSignal.timeout(30000),
    });
    if (!resposta.ok) {
      throw new Error(`Falha ao armazenar evidência no S3/RustFS (HTTP ${resposta.status})`);
    }
  }
}
