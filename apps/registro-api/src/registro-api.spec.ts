import { ExecutionContext } from '@nestjs/common';
import {
  AcessoNegado,
  CreditosInsuficientes,
  RecursoNaoEncontrado,
  RegraDeNegocioViolada,
} from '@app/compartilhado';
import { ConsultarSolicitacaoUseCase, CriarSolicitacaoUseCase } from './aplicacao';
import { assinarJwtHs256, JwtAuthGuard, verificarJwtHs256 } from './apresentacao';
import {
  ICreditosClient,
  IFilaCapturaPublisher,
  ISolicitacaoRepository,
  IValidadorUrlSegura,
  SolicitacaoRegistro,
  UrlInvalidaOuBloqueadaError,
} from './dominio';
import { DnsValidadorUrlSegura } from './infra';

describe('SolicitacaoRegistro (Entidade de Domínio)', () => {
  it('cria uma nova solicitação com status PENDENTE e transiciona corretamente', () => {
    const solicitacao = SolicitacaoRegistro.criarNova({
      id: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      url: ' https://exemplo.com/post ',
      titulo: ' Post de Teste ',
      modo: 'TELA',
      reservaId: '33333333-3333-4333-8333-333333333333',
    });

    expect(solicitacao.status).toBe('PENDENTE');
    expect(solicitacao.url).toBe('https://exemplo.com/post');
    expect(solicitacao.titulo).toBe('Post de Teste');
    expect(solicitacao.pertenceAoUsuario('22222222-2222-4222-8222-222222222222')).toBe(true);
    expect(solicitacao.pertenceAoUsuario('outro')).toBe(false);

    solicitacao.iniciarProcessamento();
    expect(solicitacao.status).toBe('PROCESSANDO');

    solicitacao.concluir();
    expect(solicitacao.status).toBe('CONCLUIDA');
    expect(() => solicitacao.falhar('erro')).toThrow(RegraDeNegocioViolada);
  });

  it('impede concluir solicitação que já falhou', () => {
    const solicitacao = SolicitacaoRegistro.criarNova({
      id: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      url: 'https://exemplo.com/post',
      titulo: 'Post',
      modo: 'TELA',
      reservaId: '33333333-3333-4333-8333-333333333333',
    });

    solicitacao.falhar('Timeout na página');
    expect(solicitacao.status).toBe('FALHOU');
    expect(solicitacao.ultimoErro).toBe('Timeout na página');
    expect(() => solicitacao.concluir()).toThrow(RegraDeNegocioViolada);
  });
});

describe('DnsValidadorUrlSegura (Política Anti-SSRF)', () => {
  it('permite URLs http/https que resolvem para IP público', async () => {
    const validador = new DnsValidadorUrlSegura(async () => [{ address: '93.184.216.34', family: 4 }]);
    await expect(validador.validar('https://example.com/artigo')).resolves.toBeUndefined();
  });

  it.each([
    'ftp://example.com/arquivo',
    'file:///etc/passwd',
    'http://localhost:3000/api/health',
    'http://postgres:5432',
    'http://elasticmq:9324',
    'http://rustfs:9000',
    'http://creditos-api:3000/api/internal/reservas',
    'http://evidencia-api:3000/api/internal/evidencias',
    'http://127.0.0.1:8080',
    'http://10.0.0.15/painel',
    'http://172.16.5.4/admin',
    'http://172.31.255.1/admin',
    'http://192.168.1.1/router',
    'http://169.254.169.254/latest/meta-data/',
    'http://0.0.0.0/',
    'http://[::1]:3000/',
    'http://[fc00::1]/',
    'http://[fe80::1]/',
    'http://[::ffff:127.0.0.1]/',
  ])('bloqueia URL insegura ou interna: %s', async (urlBloqueada) => {
    const validador = new DnsValidadorUrlSegura(async () => [{ address: '93.184.216.34', family: 4 }]);
    await expect(validador.validar(urlBloqueada)).rejects.toThrow(UrlInvalidaOuBloqueadaError);
  });

  it('bloqueia domínio externo que resolve via DNS para IP privado (DNS Rebinding / SSRF)', async () => {
    const validador = new DnsValidadorUrlSegura(async () => [{ address: '10.10.0.5', family: 4 }]);
    await expect(validador.validar('https://atacante.exemplo.com')).rejects.toThrow(
      UrlInvalidaOuBloqueadaError,
    );
  });
});

describe('CriarSolicitacaoUseCase e ConsultarSolicitacaoUseCase', () => {
  let validadorUrl: jest.Mocked<IValidadorUrlSegura>;
  let creditosClient: jest.Mocked<ICreditosClient>;
  let repositorio: jest.Mocked<ISolicitacaoRepository>;
  let filaPublisher: jest.Mocked<IFilaCapturaPublisher>;
  let criarUseCase: CriarSolicitacaoUseCase;
  let consultarUseCase: ConsultarSolicitacaoUseCase;

  const memoria = new Map<string, SolicitacaoRegistro>();

  beforeEach(() => {
    memoria.clear();
    validadorUrl = {
      validar: jest.fn().mockResolvedValue(undefined),
    };
    creditosClient = {
      reservarCredito: jest.fn().mockResolvedValue({
        reservaId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }),
      liberarReserva: jest.fn().mockResolvedValue(undefined),
    };
    repositorio = {
      criar: jest.fn(async (s) => {
        memoria.set(s.id, s);
      }),
      buscarPorId: jest.fn(async (id) => memoria.get(id) ?? null),
      atualizarStatus: jest.fn(async (id, status, erro) => {
        const atual = memoria.get(id);
        if (atual && status === 'FALHOU') {
          atual.falhar(erro ?? 'erro');
        }
      }),
      listarPendentesTravadas: jest.fn().mockResolvedValue([]),
    };
    filaPublisher = {
      publicarSolicitacao: jest.fn().mockResolvedValue(undefined),
    };

    criarUseCase = new CriarSolicitacaoUseCase(
      validadorUrl,
      creditosClient,
      repositorio,
      filaPublisher,
    );
    consultarUseCase = new ConsultarSolicitacaoUseCase(repositorio);
  });

  it('cria solicitação, reserva 1 crédito, grava como PENDENTE e publica mensagem v1 na fila', async () => {
    const resultado = await criarUseCase.executar({
      userId: '22222222-2222-4222-8222-222222222222',
      url: 'https://exemplo.com/post',
      titulo: 'Post ofensivo',
      modo: 'TELA',
    });

    expect(resultado.status).toBe('PENDENTE');
    expect(resultado.solicitacaoId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(validadorUrl.validar).toHaveBeenCalledWith('https://exemplo.com/post');
    expect(creditosClient.reservarCredito).toHaveBeenCalledWith({
      userId: '22222222-2222-4222-8222-222222222222',
      solicitacaoId: resultado.solicitacaoId,
      quantidade: 1,
    });
    expect(filaPublisher.publicarSolicitacao).toHaveBeenCalledWith(
      expect.objectContaining({
        versao: 1,
        solicitacaoId: resultado.solicitacaoId,
        reservaId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        userId: '22222222-2222-4222-8222-222222222222',
        url: 'https://exemplo.com/post',
        titulo: 'Post ofensivo',
        modo: 'TELA',
      }),
    );

    const consulta = await consultarUseCase.executar({
      solicitacaoId: resultado.solicitacaoId,
      userIdAutenticado: '22222222-2222-4222-8222-222222222222',
    });
    expect(consulta.status).toBe('PENDENTE');
    expect(consulta.url).toBe('https://exemplo.com/post');
  });

  it('não reserva crédito se a validação anti-SSRF bloquear a URL', async () => {
    validadorUrl.validar.mockRejectedValueOnce(new UrlInvalidaOuBloqueadaError('SSRF bloqueado'));

    await expect(
      criarUseCase.executar({
        userId: '22222222-2222-4222-8222-222222222222',
        url: 'http://127.0.0.1/admin',
        titulo: 'Local',
        modo: 'TELA',
      }),
    ).rejects.toThrow(UrlInvalidaOuBloqueadaError);

    expect(creditosClient.reservarCredito).not.toHaveBeenCalled();
    expect(repositorio.criar).not.toHaveBeenCalled();
    expect(filaPublisher.publicarSolicitacao).not.toHaveBeenCalled();
  });

  it('propaga CreditosInsuficientes (402) quando o usuário não possui saldo', async () => {
    creditosClient.reservarCredito.mockRejectedValueOnce(
      new CreditosInsuficientes('Sem créditos disponíveis'),
    );

    await expect(
      criarUseCase.executar({
        userId: '22222222-2222-4222-8222-222222222222',
        url: 'https://exemplo.com/post',
        titulo: 'Post',
        modo: 'TELA',
      }),
    ).rejects.toThrow(CreditosInsuficientes);

    expect(repositorio.criar).not.toHaveBeenCalled();
    expect(filaPublisher.publicarSolicitacao).not.toHaveBeenCalled();
  });

  it('libera reserva e marca como FALHOU se a publicação na fila falhar imediatamente', async () => {
    filaPublisher.publicarSolicitacao.mockRejectedValueOnce(new Error('ElasticMQ offline'));

    await expect(
      criarUseCase.executar({
        userId: '22222222-2222-4222-8222-222222222222',
        url: 'https://exemplo.com/post',
        titulo: 'Post',
        modo: 'TELA',
      }),
    ).rejects.toThrow('ElasticMQ offline');

    expect(repositorio.atualizarStatus).toHaveBeenCalledWith(
      expect.any(String),
      'FALHOU',
      'ElasticMQ offline',
    );
    expect(creditosClient.liberarReserva).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
  });

  it('bloqueia consulta de solicitação pertencente a outro usuário com AcessoNegado (403)', async () => {
    const { solicitacaoId } = await criarUseCase.executar({
      userId: 'usuario-dono',
      url: 'https://exemplo.com/post',
      titulo: 'Post',
      modo: 'TELA',
    });

    await expect(
      consultarUseCase.executar({
        solicitacaoId,
        userIdAutenticado: 'usuario-invasor',
      }),
    ).rejects.toThrow(AcessoNegado);

    await expect(
      consultarUseCase.executar({
        solicitacaoId: 'nao-existe',
        userIdAutenticado: 'usuario-dono',
      }),
    ).rejects.toThrow(RecursoNaoEncontrado);
  });
});

describe('JwtAuthGuard', () => {
  it('valida token JWT HS256 e injeta o usuário na requisição', async () => {
    const segredo = 'segredo-teste';
    process.env.JWT_SECRET = segredo;
    const token = assinarJwtHs256(
      {
        sub: 'user-123',
        jti: 'jti-456',
        tipo: 'ADVOGADO',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      segredo,
    );

    const payload = verificarJwtHs256(token, segredo);
    expect(payload.sub).toBe('user-123');

    const requisicao: { headers: { authorization?: string }; usuario?: unknown } = {
      headers: { authorization: `Bearer ${token}` },
    };
    const contexto = {
      switchToHttp: () => ({ getRequest: () => requisicao }),
    } as unknown as ExecutionContext;

    const guard = new JwtAuthGuard();
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(requisicao.usuario).toEqual({
      id: 'user-123',
      sub: 'user-123',
      jti: 'jti-456',
      tipo: 'ADVOGADO',
    });
  });
});
