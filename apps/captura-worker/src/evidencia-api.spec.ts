import { createHash } from 'node:crypto';
import { AcessoNegado, RegraDeNegocioViolada } from '@app/compartilhado';
import { SelarEvidenciaUseCase, serializarManifesto } from './aplicacao/selar-evidencia.use-case';
import { EvidenciasController } from './apresentacao/evidencias.controller';
import {
  ArquivoRecebido, CarimboTempo, IArmazenamentoEvidencia, ICarimbadorTempo,
  IEvidenciaRepository, MetadadosEvidencia, PacoteSelado,
} from './dominio';
import { Rfc3161Carimbador, criarConsultaRfc3161, interpretarRespostaRfc3161 } from './infra/rfc3161-carimbador';
import { S3ArmazenamentoAdapter } from './infra/s3-armazenamento.adapter';

const metadados: MetadadosEvidencia = {
  solicitacaoId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  url: 'https://example.org/artigo',
  inicio: '2026-11-16T13:00:00.000Z',
  fim: '2026-11-16T13:00:10.000Z',
};
const arquivos: ArquivoRecebido[] = [
  { nome: 'screenshot.png', mimeType: 'image/png', conteudo: Buffer.from('imagem-falsa') },
  { nome: 'rede.har', mimeType: 'application/json', conteudo: Buffer.from('{"log":{}}') },
];
const carimboLocal: CarimboTempo = { fonte: 'RELOGIO_LOCAL', horario: '2026-11-16T13:00:11.000Z' };

function mocks() {
  const repo: jest.Mocked<IEvidenciaRepository> = {
    buscarPorSolicitacao: jest.fn().mockResolvedValue(null),
    salvar: jest.fn(async ({ metadados: dados, pacote }) => ({ userId: dados.userId, pacote })),
  };
  const armazenamento: jest.Mocked<IArmazenamentoEvidencia> = { gravar: jest.fn().mockResolvedValue(undefined) };
  const carimbador: jest.Mocked<ICarimbadorTempo> = { carimbar: jest.fn().mockResolvedValue(carimboLocal) };
  return { repo, armazenamento, carimbador, casoDeUso: new SelarEvidenciaUseCase(repo, armazenamento, carimbador) };
}

describe('Serviço Evidência: selagem', () => {
  it('gera hashes corretos, manifesto determinístico, persiste e retorna pacote contratual', async () => {
    const { casoDeUso, repo, armazenamento, carimbador } = mocks();
    const resposta = await casoDeUso.executar(metadados, arquivos);
    expect(resposta.evidenciaId).toMatch(/^[0-9a-f-]{36}$/);
    expect(resposta.carimbo.fonte).toBe('RELOGIO_LOCAL');
    expect(resposta.arquivos.map((f) => f.tipo)).toEqual(['TELA', 'HAR']);
    for (let i = 0; i < arquivos.length; i++) {
      expect(resposta.arquivos[i].sha256).toBe(createHash('sha256').update(arquivos[i].conteudo).digest('hex'));
      expect(resposta.arquivos[i].tamanhoBytes).toBe(arquivos[i].conteudo.length);
    }
    const manifesto = serializarManifesto(metadados, resposta.arquivos);
    const hashManifesto = createHash('sha256').update(manifesto).digest('hex');
    expect(resposta.manifestoSha256).toBe(hashManifesto);
    expect(carimbador.carimbar).toHaveBeenCalledWith(hashManifesto);
    expect(armazenamento.gravar).toHaveBeenCalledTimes(3); // PNG, HAR e manifesto JSON
    expect(armazenamento.gravar).toHaveBeenCalledWith(
      `evidencias/${resposta.evidenciaId}/manifesto.json`, Buffer.from(manifesto), 'application/json',
    );
    expect(repo.salvar).toHaveBeenCalledTimes(1);
  });

  it('reutiliza pacote já selado sem carimbar nem reenviar arquivos', async () => {
    const { casoDeUso, repo, armazenamento, carimbador } = mocks();
    const pacote: PacoteSelado = { evidenciaId: 'abc', manifestoSha256: 'a'.repeat(64), carimbo: carimboLocal, arquivos: [] };
    repo.buscarPorSolicitacao.mockResolvedValue({ userId: metadados.userId, pacote });
    await expect(casoDeUso.executar(metadados, arquivos)).resolves.toEqual(pacote);
    expect(armazenamento.gravar).not.toHaveBeenCalled();
    expect(carimbador.carimbar).not.toHaveBeenCalled();
  });

  it('rejeita arquivo duplicado, caminho suspeito, MIME incorreto e datas impossíveis', async () => {
    const { casoDeUso } = mocks();
    await expect(casoDeUso.executar(metadados, [arquivos[0], arquivos[0]])).rejects.toThrow(RegraDeNegocioViolada);
    await expect(casoDeUso.executar(metadados, [{ ...arquivos[0], nome: '../segredo.png' }])).rejects.toThrow(RegraDeNegocioViolada);
    await expect(casoDeUso.executar(metadados, [{ ...arquivos[0], mimeType: 'text/plain' }])).rejects.toThrow(RegraDeNegocioViolada);
    await expect(casoDeUso.executar({ ...metadados, fim: '2020-01-01T00:00:00Z' }, arquivos)).rejects.toThrow(RegraDeNegocioViolada);
  });

  it('não grava o banco se o envio dos objetos falhar', async () => {
    const { casoDeUso, repo, armazenamento } = mocks();
    armazenamento.gravar.mockRejectedValueOnce(new Error('S3 offline'));
    await expect(casoDeUso.executar(metadados, arquivos)).rejects.toThrow('S3 offline');
    expect(repo.salvar).not.toHaveBeenCalled();
  });
});

describe('Controller HTTP interno', () => {
  const original = process.env.EVIDENCIA_INTERNAL_KEY;
  afterAll(() => { if (original === undefined) delete process.env.EVIDENCIA_INTERNAL_KEY; else process.env.EVIDENCIA_INTERNAL_KEY = original; });

  it('rejeita chave incorreta e aceita multipart válido', async () => {
    process.env.EVIDENCIA_INTERNAL_KEY = 'um-segredo-forte';
    const executar = jest.fn().mockResolvedValue({ evidenciaId: 'abc' });
    const controller = new EvidenciasController({ executar } as unknown as SelarEvidenciaUseCase);
    const upload = [{ originalname: 'screenshot.png', mimetype: 'image/png', buffer: arquivos[0].conteudo }];
    await expect(controller.criar('invalido', JSON.stringify(metadados), upload)).rejects.toThrow(AcessoNegado);
    await expect(controller.criar('um-segredo-forte', JSON.stringify(metadados), upload)).resolves.toEqual({ evidenciaId: 'abc' });
    expect(executar).toHaveBeenCalledWith(metadados, [{ nome: 'screenshot.png', mimeType: 'image/png', conteudo: arquivos[0].conteudo }]);
  });
});

describe('RustFS / S3 Signature V4', () => {
  const originais = { endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION,
    bucket: process.env.S3_BUCKET_EVIDENCIAS, key: process.env.S3_ACCESS_KEY, secret: process.env.S3_SECRET_KEY };
  afterAll(() => {
    for (const [env, value] of Object.entries({ S3_ENDPOINT: originais.endpoint, S3_REGION: originais.region,
      S3_BUCKET_EVIDENCIAS: originais.bucket, S3_ACCESS_KEY: originais.key, S3_SECRET_KEY: originais.secret })) {
      if (value === undefined) delete process.env[env]; else process.env[env] = value;
    }
  });

  it('realiza PutObject assinado, sem dependências novas', async () => {
    Object.assign(process.env, { S3_ENDPOINT: 'http://rustfs:9000', S3_REGION: 'us-east-1',
      S3_BUCKET_EVIDENCIAS: 'evidencias', S3_ACCESS_KEY: 'teste', S3_SECRET_KEY: 'senha' });
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200 } as Response);
    try {
      const dados = Buffer.from('abc');
      await new S3ArmazenamentoAdapter().gravar('evidencias/id/screenshot.png', dados, 'image/png');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, opcoes] = fetchMock.mock.calls[0];
      expect(url).toBe('http://rustfs:9000/evidencias/evidencias/id/screenshot.png');
      expect(opcoes?.method).toBe('PUT');
      const headers = opcoes?.headers as Record<string, string>;
      expect(headers.authorization).toContain('AWS4-HMAC-SHA256 Credential=teste/');
      expect(headers['content-md5']).toBe(createHash('md5').update(dados).digest('base64'));
      expect(headers['x-amz-content-sha256']).toBe(createHash('sha256').update(dados).digest('hex'));
    } finally { fetchMock.mockRestore(); }
  });
});

// Cria uma resposta DER mínima de teste para exercitar a extração do TSTInfo.
function tlv(tag: number, conteudo: Buffer): Buffer {
  if (conteudo.length < 128) return Buffer.concat([Buffer.from([tag, conteudo.length]), conteudo]);
  return Buffer.concat([Buffer.from([tag, 0x81, conteudo.length]), conteudo]);
}
const concat = (...buffers: Buffer[]) => Buffer.concat(buffers);

describe('Carimbo de tempo RFC 3161', () => {
  it('monta TimeStampReq com o hash SHA-256', () => {
    const req = criarConsultaRfc3161('ab'.repeat(32));
    expect(req[0]).toBe(0x30);
    expect(req.includes(Buffer.from('ab'.repeat(32), 'hex'))).toBe(true);
  });

  it('extrai o token e a data e valida o digest contido em TSTInfo', () => {
    const hash = 'ab'.repeat(32);
    const imprint = tlv(0x30, concat(
      Buffer.from('300d06096086480165030402010500', 'hex'), tlv(0x04, Buffer.from(hash, 'hex')),
    ));
    const tst = tlv(0x30, concat(tlv(0x02, Buffer.from([1])), tlv(0x06, Buffer.from([0x2a, 0x03])),
      imprint, tlv(0x02, Buffer.from([1])), tlv(0x18, Buffer.from('20261116130506Z'))));
    const encap = tlv(0x30, concat(tlv(0x06, Buffer.from([0x2a, 0x03])), tlv(0xa0, tlv(0x04, tst))));
    const signedData = tlv(0x30, concat(tlv(0x02, Buffer.from([3])), tlv(0x31, Buffer.alloc(0)), encap));
    const token = tlv(0x30, concat(tlv(0x06, Buffer.from([0x2a, 0x03])), tlv(0xa0, signedData)));
    const response = tlv(0x30, concat(tlv(0x30, tlv(0x02, Buffer.from([0]))), token));
    expect(interpretarRespostaRfc3161(response, hash)).toEqual({ token, horario: '2026-11-16T13:05:06.000Z' });
    expect(() => interpretarRespostaRfc3161(response, 'cd'.repeat(32))).toThrow('não corresponde');
  });

  it('marca explicitamente RELOGIO_LOCAL se FreeTSA estiver indisponível', async () => {
    const mock = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    try {
      const carimbo = await new Rfc3161Carimbador().carimbar('ab'.repeat(32));
      expect(carimbo.fonte).toBe('RELOGIO_LOCAL');
      expect(carimbo.tokenBase64).toBeUndefined();
      expect(new Date(carimbo.horario).getTime()).not.toBeNaN();
    } finally { mock.mockRestore(); }
  });
});
