import { randomUUID } from 'node:crypto';
import { RegraDeNegocioViolada } from '@app/compartilhado';

/**
 * Registro concluído (comp. 15 Conclusão do Registro do T2).
 * É o que o usuário consulta depois: a prova de que a URL foi capturada,
 * com os hashes e o carimbo do tempo vindos do pacote selado da evidencia-api.
 *
 * Entidade pura: não conhece banco, HTTP nem NestJS (SRP + DIP).
 */

export type FonteCarimbo = 'FREETSA' | 'RELOGIO_LOCAL';
export const FONTES_CARIMBO: readonly FonteCarimbo[] = ['FREETSA', 'RELOGIO_LOCAL'];

export interface Carimbo {
  fonte: FonteCarimbo;
  horario: Date;
}

export interface ArquivoEvidencia {
  nome: string;
  tipo: string;
  sha256: string;
  tamanhoBytes: number;
  chave: string;
}

export interface DadosRegistro {
  id: string;
  solicitacaoId: string;
  userId: string;
  reservaId: string;
  url: string;
  titulo: string;
  inicio: Date;
  fim: Date;
  evidenciaId: string;
  manifestoSha256: string;
  carimbo: Carimbo;
  arquivos: ArquivoEvidencia[];
  criadoEm: Date;
}

export type NovoRegistro = Omit<DadosRegistro, 'id' | 'criadoEm'>;

const SHA256_HEX = /^[0-9a-f]{64}$/i;

export class Registro {
  private constructor(private readonly dados: DadosRegistro) {}

  /** Cria um registro novo, validando as regras de negócio. */
  static criar(novo: NovoRegistro, agora: Date = new Date()): Registro {
    if (!novo.url?.trim()) throw new RegraDeNegocioViolada('O registro precisa da URL capturada');
    if (Number.isNaN(novo.inicio.getTime()) || Number.isNaN(novo.fim.getTime())) {
      throw new RegraDeNegocioViolada('Início e fim da captura precisam ser datas válidas');
    }
    if (novo.fim < novo.inicio) throw new RegraDeNegocioViolada('O fim da captura não pode ser antes do início');
    if (!FONTES_CARIMBO.includes(novo.carimbo.fonte)) {
      throw new RegraDeNegocioViolada(`Fonte de carimbo desconhecida: ${novo.carimbo.fonte}`);
    }
    if (!SHA256_HEX.test(novo.manifestoSha256)) throw new RegraDeNegocioViolada('Hash do manifesto inválido');
    if (novo.arquivos.length === 0) throw new RegraDeNegocioViolada('O registro precisa de ao menos um arquivo de evidência');
    for (const arquivo of novo.arquivos) {
      if (!SHA256_HEX.test(arquivo.sha256)) throw new RegraDeNegocioViolada(`Hash inválido no arquivo ${arquivo.nome}`);
    }

    // Hashes sempre em minúsculas, para comparar com o manifesto sem ambiguidade.
    return new Registro({
      ...novo,
      id: randomUUID(),
      criadoEm: agora,
      manifestoSha256: novo.manifestoSha256.toLowerCase(),
      carimbo: { ...novo.carimbo },
      arquivos: novo.arquivos.map((a) => ({ ...a, sha256: a.sha256.toLowerCase() })),
    });
  }

  /** Reconstrói um registro já salvo (usado pelo repositório). */
  static restaurar(dados: DadosRegistro): Registro {
    return new Registro(dados);
  }

  get id() {
    return this.dados.id;
  }
  get solicitacaoId() {
    return this.dados.solicitacaoId;
  }
  get userId() {
    return this.dados.userId;
  }

  pertenceA(userId: string): boolean {
    return this.dados.userId === userId;
  }

  /** O carimbo veio do relógio local porque a FreeTSA não respondeu. */
  get carimboDeReserva(): boolean {
    return this.dados.carimbo.fonte === 'RELOGIO_LOCAL';
  }

  paraDados(): DadosRegistro {
    return { ...this.dados, carimbo: { ...this.dados.carimbo }, arquivos: this.dados.arquivos.map((a) => ({ ...a })) };
  }
}
