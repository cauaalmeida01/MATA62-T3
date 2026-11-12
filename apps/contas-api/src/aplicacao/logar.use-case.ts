import { Inject, Injectable, Logger } from '@nestjs/common';
import { AcessoNegado } from '@app/compartilhado';
import {
  CREDITOS_CLIENT,
  EMISSOR_TOKEN,
  HASHER_SENHA,
  ICreditosClient,
  IEmissorToken,
  IHasherSenha,
  IUsuarioRepository,
  USUARIO_REPOSITORY,
  Usuario,
} from '../dominio';

export interface LogarCommand {
  email: string;
  senha: string;
}

export interface SessaoOutput {
  token: string;
  expiraEm: string;
}

/** REQ03: entrar com e-mail e senha e receber o token. */
@Injectable()
export class LogarUseCase {
  private readonly logger = new Logger(LogarUseCase.name);

  constructor(
    @Inject(USUARIO_REPOSITORY) private readonly usuarios: IUsuarioRepository,
    @Inject(HASHER_SENHA) private readonly hasher: IHasherSenha,
    @Inject(EMISSOR_TOKEN) private readonly emissor: IEmissorToken,
    @Inject(CREDITOS_CLIENT) private readonly creditos: ICreditosClient,
  ) {}

  async executar(comando: LogarCommand): Promise<SessaoOutput> {
    const usuario = await this.usuarios.buscarPorEmail(Usuario.normalizarEmail(comando.email));
    const senhaCerta = usuario ? await this.hasher.conferir(comando.senha ?? '', usuario.senhaHash) : false;

    // Mesma mensagem para e-mail inexistente e senha errada: não contamos
    // a um atacante quais e-mails estão cadastrados.
    if (!usuario || !senhaCerta) {
      throw new AcessoNegado('E-mail ou senha inválidos');
    }

    // Garante a carteira caso o cadastro não tenha conseguido criar (chamada idempotente).
    await this.creditos.criarCarteira(usuario.id).catch((erro) =>
      this.logger.warn(`Não foi possível garantir a carteira de ${usuario.id}: ${erro}`),
    );

    const { token, expiraEm } = this.emissor.emitir(usuario);
    return { token, expiraEm: expiraEm.toISOString() };
  }
}
