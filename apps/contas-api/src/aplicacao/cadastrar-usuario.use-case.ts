import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Conflito, RegraDeNegocioViolada } from '@app/compartilhado';
import {
  CREDITOS_CLIENT,
  Cpf,
  HASHER_SENHA,
  ICreditosClient,
  IHasherSenha,
  IProtetorCpf,
  IUsuarioRepository,
  PROTETOR_CPF,
  TipoUsuario,
  USUARIO_REPOSITORY,
  Usuario,
} from '../dominio';

export interface CadastrarUsuarioCommand {
  nome: string;
  email: string;
  senha: string;
  tipo: TipoUsuario;
  cpf: string;
  oab?: string;
  telefone?: string;
}

export interface UsuarioCadastradoOutput {
  id: string;
  nome: string;
  email: string;
  tipo: TipoUsuario;
}

export const TAMANHO_MINIMO_SENHA = 8;

/** REQ01: cadastrar advogado (com OAB) ou usuário comum. */
@Injectable()
export class CadastrarUsuarioUseCase {
  private readonly logger = new Logger(CadastrarUsuarioUseCase.name);

  constructor(
    @Inject(USUARIO_REPOSITORY) private readonly usuarios: IUsuarioRepository,
    @Inject(HASHER_SENHA) private readonly hasher: IHasherSenha,
    @Inject(PROTETOR_CPF) private readonly protetorCpf: IProtetorCpf,
    @Inject(CREDITOS_CLIENT) private readonly creditos: ICreditosClient,
  ) {}

  async executar(comando: CadastrarUsuarioCommand): Promise<UsuarioCadastradoOutput> {
    if ((comando.senha ?? '').length < TAMANHO_MINIMO_SENHA) {
      throw new RegraDeNegocioViolada(`A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres`);
    }
    const cpf = Cpf.criar(comando.cpf);
    const cpfHash = this.protetorCpf.hashParaBusca(cpf);
    const email = Usuario.normalizarEmail(comando.email);

    if (await this.usuarios.existeEmail(email)) {
      throw new Conflito('E-mail já cadastrado');
    }
    if (await this.usuarios.existeCpfHash(cpfHash)) {
      throw new Conflito('CPF já cadastrado');
    }

    const usuario = new Usuario({
      id: randomUUID(),
      nome: comando.nome,
      email,
      senhaHash: await this.hasher.gerarHash(comando.senha),
      tipo: comando.tipo,
      cpfCifrado: this.protetorCpf.cifrar(cpf),
      cpfHash,
      oab: comando.oab ?? null,
      telefone: comando.telefone ?? null,
      criadoEm: new Date(),
    });
    await this.usuarios.criar(usuario);

    // A carteira mora em outro serviço. Se a creditos-api estiver fora do ar, o
    // cadastro continua valendo e o login tenta criar a carteira de novo.
    await this.creditos.criarCarteira(usuario.id).catch((erro) =>
      this.logger.warn(`Carteira do usuário ${usuario.id} não foi criada agora: ${erro}`),
    );

    return { id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo };
  }
}
