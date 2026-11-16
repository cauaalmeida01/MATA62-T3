import { CreditosClient, RegistroRepositorio } from '../../dominio/portas';
import { NovoRegistro, Registro } from '../../dominio/registro';

/** Repositório em memória: prova que os casos de uso não dependem do Prisma (DIP/LSP). */
export class RegistroRepositorioEmMemoria implements RegistroRepositorio {
  readonly itens = new Map<string, Registro>();

  async buscarPorId(id: string) {
    return this.itens.get(id) ?? null;
  }
  async buscarPorSolicitacao(solicitacaoId: string) {
    return [...this.itens.values()].find((r) => r.solicitacaoId === solicitacaoId) ?? null;
  }
  async listarPorUsuario(userId: string) {
    return [...this.itens.values()]
      .filter((r) => r.pertenceA(userId))
      .sort((a, b) => b.paraDados().criadoEm.getTime() - a.paraDados().criadoEm.getTime());
  }
  async salvar(registro: Registro) {
    const existente = await this.buscarPorSolicitacao(registro.solicitacaoId);
    if (existente) return existente;
    this.itens.set(registro.id, registro);
    return registro;
  }
}

export class CreditosClientFalso implements CreditosClient {
  readonly efetivadas: string[] = [];
  erro?: Error;

  async efetivar(reservaId: string) {
    if (this.erro) throw this.erro;
    this.efetivadas.push(reservaId);
  }
}

const HASH = 'a'.repeat(64);

export function novoRegistro(extra: Partial<NovoRegistro> = {}): NovoRegistro {
  return {
    solicitacaoId: 'sol-1',
    userId: 'user-1',
    reservaId: 'res-1',
    url: 'https://exemplo.com/post',
    titulo: 'Post ofensivo',
    inicio: new Date('2026-11-12T13:00:00Z'),
    fim: new Date('2026-11-12T13:01:10Z'),
    evidenciaId: 'evi-1',
    manifestoSha256: HASH,
    carimbo: { fonte: 'FREETSA', horario: new Date('2026-11-12T13:01:11Z') },
    arquivos: [{ nome: 'tela-1.png', tipo: 'TELA', sha256: HASH, tamanhoBytes: 1234, chave: 'evidencias/evi-1/tela-1.png' }],
    ...extra,
  };
}
