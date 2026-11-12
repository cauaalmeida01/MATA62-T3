import { RegraDeNegocioViolada } from '@app/compartilhado';

export type TipoUsuario = 'ADVOGADO' | 'COMUM';

export interface UsuarioProps {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  tipo: TipoUsuario;
  cpfCifrado: string;
  cpfHash: string;
  oab: string | null;
  telefone: string | null;
  criadoEm: Date;
}

/**
 * Usuário do Veridit (comp. 01 Cadastro de Usuário). Repare que a entidade nunca
 * guarda a senha nem o CPF em texto: só o hash da senha, o CPF cifrado e o hash do CPF.
 */
export class Usuario {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly senhaHash: string;
  readonly tipo: TipoUsuario;
  readonly cpfCifrado: string;
  readonly cpfHash: string;
  readonly oab: string | null;
  readonly telefone: string | null;
  readonly criadoEm: Date;

  constructor(props: UsuarioProps) {
    if (!props.nome?.trim()) {
      throw new RegraDeNegocioViolada('Nome é obrigatório');
    }
    if (props.tipo !== 'ADVOGADO' && props.tipo !== 'COMUM') {
      throw new RegraDeNegocioViolada('Tipo de usuário inválido');
    }
    // REQ01: advogado precisa informar a inscrição na OAB.
    if (props.tipo === 'ADVOGADO' && !props.oab?.trim()) {
      throw new RegraDeNegocioViolada('Advogado precisa informar a inscrição na OAB');
    }

    this.id = props.id;
    this.nome = props.nome.trim();
    this.email = Usuario.normalizarEmail(props.email);
    this.senhaHash = props.senhaHash;
    this.tipo = props.tipo;
    this.cpfCifrado = props.cpfCifrado;
    this.cpfHash = props.cpfHash;
    this.oab = props.tipo === 'ADVOGADO' ? props.oab!.trim().toUpperCase() : null;
    this.telefone = props.telefone?.trim() || null;
    this.criadoEm = props.criadoEm;
  }

  /** "Fulano@Email.com " e "fulano@email.com" são o mesmo e-mail. */
  static normalizarEmail(email: string): string {
    return (email ?? '').trim().toLowerCase();
  }
}
