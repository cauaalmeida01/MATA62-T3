import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '.prisma/relatorios';

/**
 * Cliente Prisma só da relatorios-api, gerado de apps/relatorios-api/prisma/schema.prisma
 * (npm run prisma:relatorios). Fica restrito à camada de infra: nada fora de infra/ importa daqui.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
