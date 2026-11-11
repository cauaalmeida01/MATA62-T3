import { DeleteMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import {
  MOTIVO_RECONCILIACAO_TIMEOUT,
  ProcessarCapturaUseCase,
  ProcessarDlqUseCase,
  ReconciliarSolicitacoesTravadasUseCase,
} from './aplicacao';
import {
  FalhaCapturaError,
  ICreditosClient,
  IEvidenciaClient,
  IMotorCaptura,
  IRelatoriosClient,
  ISolicitacaoWorkerRepository,
  IValidadorUrlSegura,
  MensagemFilaCapturaV1,
  PacoteEvidenciaSelado,
  SolicitacaoWorker,
  UrlInvalidaOuBloqueadaWorkerError,
} from './dominio';
import {
  DnsValidadorUrlSeguraWorker,
  SqsCapturaConsumer,
  SqsDlqConsumer,
} from './infra';

describe('captura-worker — Casos de Uso, Consumidores SQS/DLQ e Job de Reconciliação', () => {
  let repositorio: jest.Mocked<ISolicitacaoWorkerRepository>;
  let validadorUrl: jest.Mocked<IValidadorUrlSegura>;
  let motorCaptura: jest.Mocked<IMotorCaptura>;
  let evidenciaClient: jest.Mocked<IEvidenciaClient>;
  let relatoriosClient: jest.Mocked<IRelatoriosClient>;
  let creditosClient: jest.Mocked<ICreditosClient>;

  let processarCapturaUseCase: ProcessarCapturaUseCase;
  let processarDlqUseCase: ProcessarDlqUseCase;
  let reconciliarUseCase: ReconciliarSolicitacoesTravadasUseCase;

  const solicitacaoId = '11111111-1111-4111-8111-111111111111';
  const reservaId = '22222222-2222-4222-8222-222222222222';
  const userId = '33333333-3333-4333-8333-333333333333';

  const mensagemPadrao: MensagemFilaCapturaV1 = {
    versao: 1,
    solicitacaoId,
    reservaId,
    userId,
    url: 'https://exemplo.com/publicacao',
    titulo: 'Publicação sob investigação',
    modo: 'TELA',
    solicitadoEm: '2026-11-11T13:00:00.000Z',
  };

  const pacoteSeladoMock: PacoteEvidenciaSelado = {
    evidenciaId: '44444444-4444-4444-8444-444444444444',
    manifestoSha256: 'abc123def456',
    carimbo: {
      fonte: 'FREETSA',
      horario: '2026-11-11T13:00:05.000Z',
      tokenBase64: 'dG9rZW4=',
    },
    arquivos: [
      {
        nome: 'screenshot.png',
        tipo: 'TELA',
        sha256: 'hash-png',
        tamanhoBytes: 1024,
        chave: 'evidencias/444/screenshot.png',
      },
      {
        nome: 'rede.har',
        tipo: 'HAR',
        sha256: 'hash-har',
        tamanhoBytes: 2048,
        chave: 'evidencias/444/rede.har',
      },
    ],
  };

  let bancoMemoria: Map<string, SolicitacaoWorker>;

  beforeEach(() => {
    bancoMemoria = new Map<string, SolicitacaoWorker>();
    bancoMemoria.set(solicitacaoId, {
      id: solicitacaoId,
      userId,
      url: mensagemPadrao.url,
      titulo: mensagemPadrao.titulo,
      modo: 'TELA',
      status: 'PENDENTE',
      reservaId,
      ultimoErro: null,
      criadaEm: new Date('2026-11-11T13:00:00.000Z'),
      atualizadaEm: new Date('2026-11-11T13:00:00.000Z'),
    });

    repositorio = {
      buscarPorId: jest.fn(async (id) => bancoMemoria.get(id) ?? null),
      marcarProcessando: jest.fn(async (id) => {
        const atual = bancoMemoria.get(id);
        if (atual && atual.status !== 'CONCLUIDA') {
          atual.status = 'PROCESSANDO';
          atual.atualizadaEm = new Date();
        }
      }),
      marcarConcluida: jest.fn(async (id) => {
        const atual = bancoMemoria.get(id);
        if (atual) {
          atual.status = 'CONCLUIDA';
          atual.ultimoErro = null;
          atual.atualizadaEm = new Date();
        }
      }),
      marcarFalhou: jest.fn(async (id, motivo) => {
        const atual = bancoMemoria.get(id);
        if (atual && atual.status !== 'CONCLUIDA') {
          atual.status = 'FALHOU';
          atual.ultimoErro = motivo;
          atual.atualizadaEm = new Date();
        }
      }),
      registrarTentativaComErro: jest.fn(async (id, motivo) => {
        const atual = bancoMemoria.get(id);
        if (atual && atual.status !== 'CONCLUIDA') {
          atual.ultimoErro = motivo;
          atual.atualizadaEm = new Date();
        }
      }),
      listarPendentesOuProcessandoTravadas: jest.fn().mockResolvedValue([]),
    };

    validadorUrl = {
      validar: jest.fn().mockResolvedValue(undefined),
    };

    motorCaptura = {
      capturar: jest.fn().mockResolvedValue({
        inicio: new Date('2026-11-11T13:00:01.000Z'),
        fim: new Date('2026-11-11T13:00:04.000Z'),
        urlFinal: mensagemPadrao.url,
        statusHttp: 200,
        userAgent: 'VeriditBot/1.0',
        viewport: { width: 1366, height: 768 },
        arquivos: [
          {
            nome: 'screenshot.png',
            tipo: 'TELA',
            mimeType: 'image/png',
            conteudo: Buffer.from('png-fake'),
          },
          {
            nome: 'rede.har',
            tipo: 'HAR',
            mimeType: 'application/json',
            conteudo: Buffer.from('{"log":{}}'),
          },
        ],
      }),
    };

    evidenciaClient = {
      selarEvidencia: jest.fn().mockResolvedValue(pacoteSeladoMock),
    };

    relatoriosClient = {
      concluirRegistro: jest.fn().mockResolvedValue({
        registroId: '55555555-5555-4555-8555-555555555555',
      }),
    };

    creditosClient = {
      liberarReserva: jest.fn().mockResolvedValue(undefined),
    };

    processarCapturaUseCase = new ProcessarCapturaUseCase(
      repositorio,
      validadorUrl,
      motorCaptura,
      evidenciaClient,
      relatoriosClient,
    );

    processarDlqUseCase = new ProcessarDlqUseCase(repositorio, creditosClient);
    reconciliarUseCase = new ReconciliarSolicitacoesTravadasUseCase(repositorio, creditosClient);
  });

  it('executa o fluxo completo de sucesso do ProcessarCapturaUseCase (REQ11)', async () => {
    const resultado = await processarCapturaUseCase.executar(mensagemPadrao);

    expect(resultado).toEqual({
      solicitacaoId,
      status: 'CONCLUIDA',
      evidenciaId: pacoteSeladoMock.evidenciaId,
      registroId: '55555555-5555-4555-8555-555555555555',
    });

    expect(repositorio.marcarProcessando).toHaveBeenCalledWith(solicitacaoId);
    expect(validadorUrl.validar).toHaveBeenCalledWith(mensagemPadrao.url);
    expect(motorCaptura.capturar).toHaveBeenCalledWith({
      url: mensagemPadrao.url,
      modo: 'TELA',
      solicitacaoId,
    });
    expect(evidenciaClient.selarEvidencia).toHaveBeenCalledWith(
      expect.objectContaining({
        metadados: {
          solicitacaoId,
          userId,
          url: mensagemPadrao.url,
          inicio: '2026-11-11T13:00:01.000Z',
          fim: '2026-11-11T13:00:04.000Z',
        },
        arquivos: expect.arrayContaining([
          expect.objectContaining({ nome: 'screenshot.png', tipo: 'TELA' }),
          expect.objectContaining({ nome: 'rede.har', tipo: 'HAR' }),
        ]),
      }),
    );
    expect(relatoriosClient.concluirRegistro).toHaveBeenCalledWith(solicitacaoId, {
      userId,
      reservaId,
      url: mensagemPadrao.url,
      titulo: mensagemPadrao.titulo,
      inicio: '2026-11-11T13:00:01.000Z',
      fim: '2026-11-11T13:00:04.000Z',
      pacote: pacoteSeladoMock,
    });
    expect(repositorio.marcarConcluida).toHaveBeenCalledWith(solicitacaoId);
    expect(bancoMemoria.get(solicitacaoId)?.status).toBe('CONCLUIDA');
  });

  it('é idempotente quando a solicitação já está CONCLUIDA', async () => {
    bancoMemoria.get(solicitacaoId)!.status = 'CONCLUIDA';

    const resultado = await processarCapturaUseCase.executar(mensagemPadrao);

    expect(resultado).toEqual({
      solicitacaoId,
      status: 'JA_CONCLUIDA',
    });
    expect(repositorio.marcarProcessando).not.toHaveBeenCalled();
    expect(motorCaptura.capturar).not.toHaveBeenCalled();
    expect(evidenciaClient.selarEvidencia).not.toHaveBeenCalled();
    expect(relatoriosClient.concluirRegistro).not.toHaveBeenCalled();
  });

  it('registra ultimo_erro e relança exceção sem confirmar mensagem na fila principal quando a captura falha', async () => {
    motorCaptura.capturar.mockRejectedValueOnce(
      new FalhaCapturaError('Timeout ao carregar página de destino'),
    );

    const sqsSendMock = jest.fn().mockResolvedValue({});
    const sqsClientFalso = { send: sqsSendMock } as unknown as SQSClient;
    const consumer = new SqsCapturaConsumer(processarCapturaUseCase, sqsClientFalso);

    await expect(
      consumer.processarMensagemUnica({
        MessageId: 'msg-1',
        ReceiptHandle: 'receipt-1',
        Body: JSON.stringify(mensagemPadrao),
      }),
    ).rejects.toThrow('Timeout ao carregar página de destino');

    // Garante que o erro foi registrado na solicitação, mas a mensagem NÃO foi deletada da fila
    expect(repositorio.registrarTentativaComErro).toHaveBeenCalledWith(
      solicitacaoId,
      'Timeout ao carregar página de destino',
    );
    expect(sqsSendMock).not.toHaveBeenCalledWith(expect.any(DeleteMessageCommand));
  });

  it('processa mensagem na DLQ (ProcessarDlqUseCase) liberando reserva de crédito e marcando como FALHOU', async () => {
    bancoMemoria.get(solicitacaoId)!.ultimoErro = 'Timeout ao carregar página';

    const sqsSendMock = jest.fn().mockResolvedValue({});
    const sqsClientFalso = { send: sqsSendMock } as unknown as SQSClient;
    const dlqConsumer = new SqsDlqConsumer(processarDlqUseCase, sqsClientFalso);

    await dlqConsumer.processarMensagemDlqUnica({
      MessageId: 'dlq-1',
      ReceiptHandle: 'receipt-dlq-1',
      Body: JSON.stringify(mensagemPadrao),
    });

    expect(creditosClient.liberarReserva).toHaveBeenCalledWith(
      reservaId,
      expect.stringContaining('Falha definitiva após 3 tentativas de captura (DLQ): Timeout ao carregar página'),
    );
    expect(repositorio.marcarFalhou).toHaveBeenCalledWith(
      solicitacaoId,
      expect.stringContaining('Falha definitiva após 3 tentativas de captura (DLQ): Timeout ao carregar página'),
    );
    expect(bancoMemoria.get(solicitacaoId)?.status).toBe('FALHOU');
    expect(sqsSendMock).toHaveBeenCalledTimes(1);
  });

  it('executa o Job de Reconciliação (ReconciliarSolicitacoesTravadasUseCase) limpando solicitações travadas há mais de 15 min', async () => {
    const travada1 = bancoMemoria.get(solicitacaoId)!;
    const travada2: SolicitacaoWorker = {
      id: '99999999-9999-4999-8999-999999999999',
      userId,
      url: 'https://exemplo.com/2',
      titulo: 'Outra travada',
      modo: 'TELA',
      status: 'PROCESSANDO',
      reservaId: '88888888-8888-4888-8888-888888888888',
      ultimoErro: null,
      criadaEm: new Date('2026-11-11T12:00:00.000Z'),
      atualizadaEm: new Date('2026-11-11T12:00:00.000Z'),
    };
    bancoMemoria.set(travada2.id, travada2);

    repositorio.listarPendentesOuProcessandoTravadas.mockResolvedValueOnce([travada1, travada2]);

    const resultado = await reconciliarUseCase.executar(15);

    expect(resultado).toEqual({
      totalEncontradas: 2,
      reconciliadasComSucesso: 2,
      falhas: 0,
    });
    expect(creditosClient.liberarReserva).toHaveBeenCalledWith(
      travada1.reservaId,
      MOTIVO_RECONCILIACAO_TIMEOUT,
    );
    expect(creditosClient.liberarReserva).toHaveBeenCalledWith(
      travada2.reservaId,
      MOTIVO_RECONCILIACAO_TIMEOUT,
    );
    expect(bancoMemoria.get(travada1.id)?.status).toBe('FALHOU');
    expect(bancoMemoria.get(travada2.id)?.status).toBe('FALHOU');
    expect(bancoMemoria.get(travada1.id)?.ultimoErro).toBe(MOTIVO_RECONCILIACAO_TIMEOUT);
  });

  it('DnsValidadorUrlSeguraWorker bloqueia DNS Rebinding para IP privado no momento da captura', async () => {
    const validador = new DnsValidadorUrlSeguraWorker(async () => [
      { address: '169.254.169.254', family: 4 },
    ]);

    await expect(validador.validar('https://rebinding.atacante.com/post')).rejects.toThrow(
      UrlInvalidaOuBloqueadaWorkerError,
    );
  });
});
