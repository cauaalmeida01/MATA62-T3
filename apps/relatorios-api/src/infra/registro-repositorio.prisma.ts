import { Injectable } from '@nestjs/common';
import { Prisma } from '.prisma/relatorios';
import { RegistroRepositorio } from '../dominio/portas';
import { FonteCarimbo, Registro } from '../dominio/registro';
import { PrismaService } from './prisma.service';

type LinhaRegistro = Prisma.RegistroGetPayload<{ include: { arquivos: true } }>;

/** Adaptador do RegistroRepositorio para o PostgreSQL via Prisma (DIP: o domínio não conhece esta classe). */
@Injectable()
export class RegistroRepositorioPrisma implements RegistroRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorId(id: string): Promise<Registro | null> {
    if (!UUID.test(id)) return null; // evita erro de tipo do Postgres com ids malformados
    const linha = await this.prisma.registro.findUnique({ where: { id }, include: INCLUIR });
    return linha ? paraEntidade(linha) : null;
  }

  async buscarPorSolicitacao(solicitacaoId: string): Promise<Registro | null> {
    const linha = await this.prisma.registro.findUnique({ where: { solicitacaoId }, include: INCLUIR });
    return linha ? paraEntidade(linha) : null;
  }

  async listarPorUsuario(userId: string): Promise<Registro[]> {
    const linhas = await this.prisma.registro.findMany({
      where: { userId },
      include: INCLUIR,
      orderBy: { criadoEm: 'desc' },
    });
    return linhas.map(paraEntidade);
  }

  async salvar(registro: Registro): Promise<Registro> {
    const d = registro.paraDados();
    try {
      await this.prisma.registro.create({
        data: {
          id: d.id,
          solicitacaoId: d.solicitacaoId,
          userId: d.userId,
          reservaId: d.reservaId,
          url: d.url,
          titulo: d.titulo,
          inicio: d.inicio,
          fim: d.fim,
          evidenciaId: d.evidenciaId,
          manifestoSha256: d.manifestoSha256,
          carimboFonte: d.carimbo.fonte,
          carimboHorario: d.carimbo.horario,
          criadoEm: d.criadoEm,
          arquivos: {
            create: d.arquivos.map((a) => ({
              nome: a.nome,
              tipo: a.tipo,
              sha256: a.sha256,
              tamanhoBytes: BigInt(a.tamanhoBytes),
              chave: a.chave,
            })),
          },
        },
      });
      return registro;
    } catch (erro) {
      // Duas conclusões da mesma solicitação ao mesmo tempo: a segunda bate no índice único.
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        const existente = await this.buscarPorSolicitacao(d.solicitacaoId);
        if (existente) return existente;
      }
      throw erro;
    }
  }
}

/** Arquivos sempre na mesma ordem no detalhe. */
const INCLUIR = { arquivos: { orderBy: { nome: 'asc' as const } } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function paraEntidade(linha: LinhaRegistro): Registro {
  return Registro.restaurar({
    id: linha.id,
    solicitacaoId: linha.solicitacaoId,
    userId: linha.userId,
    reservaId: linha.reservaId,
    url: linha.url,
    titulo: linha.titulo,
    inicio: linha.inicio,
    fim: linha.fim,
    evidenciaId: linha.evidenciaId,
    manifestoSha256: linha.manifestoSha256,
    carimbo: { fonte: linha.carimboFonte as FonteCarimbo, horario: linha.carimboHorario },
    arquivos: linha.arquivos.map((a) => ({
      nome: a.nome,
      tipo: a.tipo,
      sha256: a.sha256,
      tamanhoBytes: Number(a.tamanhoBytes),
      chave: a.chave,
    })),
    criadoEm: linha.criadoEm,
  });
}
