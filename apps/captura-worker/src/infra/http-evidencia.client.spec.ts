import { HttpEvidenciaClient } from './http-evidencia.client';

describe('HttpEvidenciaClient — autenticação multipart', () => {
  const chaveOriginal = process.env.EVIDENCIA_INTERNAL_KEY;

  afterEach(() => {
    jest.restoreAllMocks();
    if (chaveOriginal === undefined) delete process.env.EVIDENCIA_INTERNAL_KEY;
    else process.env.EVIDENCIA_INTERNAL_KEY = chaveOriginal;
  });

  it.each(['segredo-apenas-para-teste', undefined])(
    'envia a chave %s sem definir Content-Type manualmente',
    async (chave) => {
      if (chave === undefined) delete process.env.EVIDENCIA_INTERNAL_KEY;
      else process.env.EVIDENCIA_INTERNAL_KEY = chave;
      const pacote = { evidenciaId: 'evidencia-teste', manifestoSha256: 'abc' };
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(pacote), { status: 201 }),
      );
      const metadados = {
        solicitacaoId: 'solicitacao-teste', userId: 'usuario-teste',
        url: 'https://example.com', inicio: '2026-11-16T12:00:00Z',
        fim: '2026-11-16T12:01:00Z',
      };

      await expect(new HttpEvidenciaClient().selarEvidencia({
        metadados,
        arquivos: [{ nome: 'pagina.html', tipo: 'HTML', mimeType: 'text/html',
          conteudo: Buffer.from('<html></html>') }],
      })).resolves.toEqual(pacote);

      const [url, opcoes] = fetchSpy.mock.calls[0];
      expect(String(url)).toMatch(/\/internal\/evidencias$/);
      expect(opcoes?.method).toBe('POST');
      const request = new Request(url, opcoes);
      expect(request.headers.get('x-internal-api-key')).toBe(chave ?? '');
      expect(new Headers(opcoes?.headers).has('Content-Type')).toBe(false);
      expect(request.headers.get('Content-Type')).toMatch(/^multipart\/form-data; boundary=/);
      const form = await request.formData();
      expect(JSON.parse(String(form.get('metadados')))).toEqual(metadados);
      const arquivo = form.get('arquivos') as File;
      expect(arquivo.name).toBe('pagina.html');
      expect(await arquivo.text()).toBe('<html></html>');
    },
  );
});
