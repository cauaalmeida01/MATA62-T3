import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac, randomUUID } from 'node:crypto';
import { FiltroErrosDominio } from '@app/compartilhado';
import { ConcluirRegistro } from '../aplicacao/concluir-registro';
import { DetalharRegistro, ListarRegistros } from '../aplicacao/consultar-registros';
import { CreditosClientFalso, RegistroRepositorioEmMemoria } from '../aplicacao/testes/dubles';
import { ReservaJaLiberada } from '../dominio/erros';
import { CREDITOS_CLIENT, REGISTRO_REPOSITORIO } from '../dominio/portas';
import { AutenticacaoGuard, JWT_SECRET } from './autenticacao.guard';
import { ConclusaoController, RegistrosController } from './registros.controller';

const SEGREDO = 'segredo-de-teste';
const HASH = 'b'.repeat(64);

function token(sub: string, expiraEmSegundos = 3600, segredo = SEGREDO) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const cabecalho = b64({ alg: 'HS256', typ: 'JWT' });
  const corpo = b64({ sub, jti: randomUUID(), tipo: 'COMUM', exp: Math.floor(Date.now() / 1000) + expiraEmSegundos });
  const assinatura = createHmac('sha256', segredo).update(`${cabecalho}.${corpo}`).digest('base64url');
  return `${cabecalho}.${corpo}.${assinatura}`;
}

function conclusao(userId: string) {
  return {
    userId,
    reservaId: randomUUID(),
    url: 'https://exemplo.com/post',
    titulo: 'Post ofensivo',
    inicio: '2026-11-12T13:00:00.000Z',
    fim: '2026-11-12T13:01:10.000Z',
    pacote: {
      evidenciaId: randomUUID(),
      manifestoSha256: HASH,
      carimbo: { fonte: 'FREETSA', horario: '2026-11-12T13:01:11Z', tokenBase64: 'abc' },
      arquivos: [{ nome: 'tela-1.png', tipo: 'TELA', sha256: HASH, tamanhoBytes: 10, chave: 'evidencias/x/tela-1.png' }],
    },
  };
}

/** Testa a camada HTTP inteira (validação, guard, filtro de erros) com dublês no lugar do banco e da creditos-api. */
describe('Rotas da relatorios-api', () => {
  let app: INestApplication;
  let base: string;
  let creditos: CreditosClientFalso;
  const ana = randomUUID();
  const bia = randomUUID();

  beforeEach(async () => {
    creditos = new CreditosClientFalso();
    const modulo = await Test.createTestingModule({
      controllers: [RegistrosController, ConclusaoController],
      providers: [
        ConcluirRegistro,
        ListarRegistros,
        DetalharRegistro,
        AutenticacaoGuard,
        { provide: REGISTRO_REPOSITORIO, useValue: new RegistroRepositorioEmMemoria() },
        { provide: CREDITOS_CLIENT, useValue: creditos },
        { provide: JWT_SECRET, useValue: SEGREDO },
      ],
    }).compile();

    app = modulo.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new FiltroErrosDominio());
    await app.listen(0);
    base = `${await app.getUrl()}/api`.replace('[::1]', 'localhost');
  });

  afterEach(() => app.close());

  const concluir = (solicitacaoId: string, corpo: object) =>
    fetch(`${base}/internal/registros/${solicitacaoId}/conclusao`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    });

  const get = (caminho: string, autorizacao?: string) =>
    fetch(`${base}${caminho}`, { headers: autorizacao ? { authorization: `Bearer ${autorizacao}` } : {} });

  it('conclusão: 201 na primeira chamada e 200 com o mesmo id na repetida', async () => {
    const solicitacaoId = randomUUID();
    const corpo = conclusao(ana);

    const primeira = await concluir(solicitacaoId, corpo);
    const segunda = await concluir(solicitacaoId, corpo);

    expect(primeira.status).toBe(201);
    expect(segunda.status).toBe(200);
    expect((await segunda.json()).registroId).toBe((await primeira.json()).registroId);
    expect(creditos.efetivadas).toEqual([corpo.reservaId]);
  });

  it('conclusão com corpo inválido responde 400 DADOS_INVALIDOS', async () => {
    const resposta = await concluir(randomUUID(), { ...conclusao(ana), pacote: { arquivos: [] } });
    expect(resposta.status).toBe(400);
    expect((await resposta.json()).erro.codigo).toBe('DADOS_INVALIDOS');
  });

  it('conclusão com reserva já liberada responde 409 CONFLITO', async () => {
    creditos.erro = new ReservaJaLiberada('x');
    const resposta = await concluir(randomUUID(), conclusao(ana));
    expect(resposta.status).toBe(409);
    expect((await resposta.json()).erro.codigo).toBe('CONFLITO');
  });

  it('lista e detalha só os registros do dono do token', async () => {
    const { registroId } = await (await concluir(randomUUID(), conclusao(ana))).json();
    await concluir(randomUUID(), conclusao(bia));

    const lista = await (await get('/registros', token(ana))).json();
    expect(lista).toHaveLength(1);
    expect(lista[0].id).toBe(registroId);

    const detalhe = await get(`/registros/${registroId}`, token(ana));
    expect(detalhe.status).toBe(200);
    expect((await detalhe.json()).arquivos[0].sha256).toBe(HASH);

    const deOutro = await get(`/registros/${registroId}`, token(bia));
    expect(deOutro.status).toBe(404);
  });

  it.each([
    ['sem token', undefined],
    ['token expirado', token(randomUUID(), -10)],
    ['assinatura errada', token(randomUUID(), 3600, 'outro-segredo')],
  ])('rotas públicas recusam %s com 401', async (_, autorizacao) => {
    expect((await get('/registros', autorizacao)).status).toBe(401);
  });
});
