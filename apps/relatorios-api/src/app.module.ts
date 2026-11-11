import { Module } from '@nestjs/common';
import { HealthModule } from '@app/compartilhado';
import { ConcluirRegistro } from './aplicacao/concluir-registro';
import { DetalharRegistro, ListarRegistros } from './aplicacao/consultar-registros';
import { CREDITOS_CLIENT, REGISTRO_REPOSITORIO } from './dominio/portas';
import { AutenticacaoGuard, JWT_SECRET } from './entrada/autenticacao.guard';
import { ConclusaoController, RegistrosController } from './entrada/registros.controller';
import { CREDITOS_URL, CreditosClientHttp } from './infra/creditos-client.http';
import { PrismaService } from './infra/prisma.service';
import { RegistroRepositorioPrisma } from './infra/registro-repositorio.prisma';

/**
 * Serviço Registros e Relatórios (comp. 15 Conclusão do Registro, 18 Consulta).
 *
 * Raiz de composição: o único lugar que sabe qual implementação atende cada porta.
 * Trocar Prisma ou HTTP por outra tecnologia muda só esta lista (DIP + OCP).
 */
@Module({
  imports: [HealthModule.para('relatorios-api')],
  controllers: [RegistrosController, ConclusaoController],
  providers: [
    ConcluirRegistro,
    ListarRegistros,
    DetalharRegistro,
    AutenticacaoGuard,
    PrismaService,
    { provide: REGISTRO_REPOSITORIO, useClass: RegistroRepositorioPrisma },
    { provide: CREDITOS_CLIENT, useClass: CreditosClientHttp },
    { provide: CREDITOS_URL, useFactory: () => obrigatoria('CREDITOS_URL') },
    { provide: JWT_SECRET, useFactory: () => obrigatoria('JWT_SECRET') },
  ],
})
export class AppModule {}

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ${nome} não definida`);
  return valor;
}
