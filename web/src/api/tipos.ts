// Formatos das rotas públicas (docs/contratos.md, seção 2).

export type TipoUsuario = 'ADVOGADO' | 'COMUM';
export type StatusSolicitacao = 'PENDENTE' | 'PROCESSANDO' | 'CONCLUIDA' | 'FALHOU';
export type FonteCarimbo = 'FREETSA' | 'RELOGIO_LOCAL';

export interface NovoCadastro {
  nome: string;
  email: string;
  senha: string;
  cpf: string;
  tipo: TipoUsuario;
  oab?: string;
  telefone?: string;
}

export interface Sessao {
  token: string;
  expiraEm: string;
}

export interface Saldo {
  disponivel: number;
  reservado: number;
}

export interface Solicitacao {
  solicitacaoId: string;
  status: StatusSolicitacao;
}

export interface RegistroResumo {
  id: string;
  url: string;
  titulo: string;
  inicio: string;
  fim: string;
  carimbo: { fonte: FonteCarimbo; horario: string };
  criadoEm: string;
}

export interface RegistroDetalhe extends RegistroResumo {
  solicitacaoId: string;
  evidenciaId: string;
  manifestoSha256: string;
  arquivos: { nome: string; tipo: string; sha256: string; tamanhoBytes: number }[];
}

/** Erro no formato único dos serviços: { erro: { codigo, mensagem } }. */
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

/**
 * Tudo o que as telas precisam do back. As telas dependem só desta interface (DIP):
 * a implementação HTTP e a falsa (modo mock) são trocáveis sem mexer nas telas.
 */
export interface VeriditApi {
  cadastrar(dados: NovoCadastro): Promise<void>;
  entrar(email: string, senha: string): Promise<Sessao>;
  sair(token: string): Promise<void>;
  saldo(token: string): Promise<Saldo>;
  solicitarRegistro(token: string, url: string, titulo: string): Promise<Solicitacao>;
  statusSolicitacao(token: string, id: string): Promise<Solicitacao>;
  listarRegistros(token: string): Promise<RegistroResumo[]>;
  detalharRegistro(token: string, id: string): Promise<RegistroDetalhe>;
}
