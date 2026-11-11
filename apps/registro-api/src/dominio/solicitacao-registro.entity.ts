import { RegraDeNegocioViolada } from '@app/compartilhado';

export type ModoCaptura = 'TELA';

export type StatusSolicitacao = 'PENDENTE' | 'PROCESSANDO' | 'CONCLUIDA' | 'FALHOU';

export interface SolicitacaoRegistroProps {
  id: string;
  userId: string;
  url: string;
  titulo: string;
  modo: ModoCaptura;
  status: StatusSolicitacao;
  reservaId: string;
  ultimoErro?: string | null;
  criadaEm: Date;
  atualizadaEm: Date;
}

export interface CriarNovaSolicitacaoProps {
  id: string;
  userId: string;
  url: string;
  titulo: string;
  modo: ModoCaptura;
  reservaId: string;
  agora?: Date;
}

/**
 * Entidade de domínio que representa uma linha em `registro.solicitacoes` (REQ08).
 */
export class SolicitacaoRegistro {
  readonly id: string;
  readonly userId: string;
  readonly url: string;
  readonly titulo: string;
  readonly modo: ModoCaptura;
  private _status: StatusSolicitacao;
  readonly reservaId: string;
  private _ultimoErro: string | null;
  readonly criadaEm: Date;
  private _atualizadaEm: Date;

  constructor(props: SolicitacaoRegistroProps) {
    if (!props.id?.trim()) {
      throw new RegraDeNegocioViolada('ID da solicitação é obrigatório');
    }
    if (!props.userId?.trim()) {
      throw new RegraDeNegocioViolada('ID do usuário é obrigatório');
    }
    if (!props.url?.trim()) {
      throw new RegraDeNegocioViolada('URL da solicitação é obrigatória');
    }
    if (!props.titulo?.trim()) {
      throw new RegraDeNegocioViolada('Título da solicitação é obrigatório');
    }
    if (props.modo !== 'TELA') {
      throw new RegraDeNegocioViolada('Modo de captura inválido; apenas TELA é suportado');
    }
    if (!props.reservaId?.trim()) {
      throw new RegraDeNegocioViolada('ID da reserva de crédito é obrigatório');
    }

    this.id = props.id;
    this.userId = props.userId;
    this.url = props.url.trim();
    this.titulo = props.titulo.trim();
    this.modo = props.modo;
    this._status = props.status;
    this.reservaId = props.reservaId;
    this._ultimoErro = props.ultimoErro ?? null;
    this.criadaEm = props.criadaEm;
    this._atualizadaEm = props.atualizadaEm;
  }

  static criarNova(props: CriarNovaSolicitacaoProps): SolicitacaoRegistro {
    const agora = props.agora ?? new Date();
    return new SolicitacaoRegistro({
      id: props.id,
      userId: props.userId,
      url: props.url,
      titulo: props.titulo,
      modo: props.modo,
      status: 'PENDENTE',
      reservaId: props.reservaId,
      ultimoErro: null,
      criadaEm: agora,
      atualizadaEm: agora,
    });
  }

  get status(): StatusSolicitacao {
    return this._status;
  }

  get ultimoErro(): string | null {
    return this._ultimoErro;
  }

  get atualizadaEm(): Date {
    return this._atualizadaEm;
  }

  pertenceAoUsuario(userId: string): boolean {
    return this.userId === userId;
  }

  iniciarProcessamento(agora = new Date()): void {
    if (this._status === 'CONCLUIDA' || this._status === 'FALHOU') {
      throw new RegraDeNegocioViolada(
        `Não é possível iniciar processamento de solicitação com status ${this._status}`,
      );
    }
    this._status = 'PROCESSANDO';
    this._atualizadaEm = agora;
  }

  concluir(agora = new Date()): void {
    if (this._status === 'FALHOU') {
      throw new RegraDeNegocioViolada('Não é possível concluir uma solicitação que já falhou');
    }
    this._status = 'CONCLUIDA';
    this._ultimoErro = null;
    this._atualizadaEm = agora;
  }

  falhar(motivo: string, agora = new Date()): void {
    if (this._status === 'CONCLUIDA') {
      throw new RegraDeNegocioViolada('Não é possível marcar como falha uma solicitação já concluída');
    }
    this._status = 'FALHOU';
    this._ultimoErro = motivo?.trim() || 'Falha no processamento da captura';
    this._atualizadaEm = agora;
  }
}
