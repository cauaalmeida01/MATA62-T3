import { Module } from '@nestjs/common';
import { HealthModule, JwtAuthGuard, TOKENS_REVOGADOS } from '@app/compartilhado';
import { ContasDatabaseService, PostgresTokensRevogados } from '@app/infra';
import { CadastrarUsuarioUseCase, LogarUseCase, SairUseCase } from './aplicacao';
import { ContasController } from './apresentacao';
import { CREDITOS_CLIENT, EMISSOR_TOKEN, HASHER_SENHA, PROTETOR_CPF, USUARIO_REPOSITORY } from './dominio';
import {
  AesProtetorCpf,
  HttpCreditosClient,
  JwtEmissorToken,
  PostgresUsuarioRepository,
  ScryptHasherSenha,
} from './infra';

/**
 * Serviço Contas (comp. 01 Cadastro de Usuário, 02 Acesso e Sessão): REQ01, REQ03, REQ04.
 * Aqui é o único lugar que liga cada porta (interface) ao adaptador concreto.
 */
@Module({
  imports: [HealthModule.para('contas-api')],
  controllers: [ContasController],
  providers: [
    ContasDatabaseService,
    JwtAuthGuard,
    CadastrarUsuarioUseCase,
    LogarUseCase,
    SairUseCase,
    { provide: USUARIO_REPOSITORY, useClass: PostgresUsuarioRepository },
    { provide: HASHER_SENHA, useValue: new ScryptHasherSenha() },
    { provide: PROTETOR_CPF, useFactory: () => new AesProtetorCpf() },
    { provide: EMISSOR_TOKEN, useFactory: () => new JwtEmissorToken() },
    { provide: CREDITOS_CLIENT, useFactory: () => new HttpCreditosClient() },
    {
      provide: TOKENS_REVOGADOS,
      useFactory: (db: ContasDatabaseService) => new PostgresTokensRevogados(db),
      inject: [ContasDatabaseService],
    },
  ],
})
export class AppModule {}
