import { Injectable } from '@nestjs/common';
import { Conflito } from '@app/compartilhado';
import { ContasDatabaseService } from '@app/infra';
import { IUsuarioRepository, TipoUsuario, Usuario } from '../dominio';

interface LinhaUsuario {
  id: string;
  nome: string;
  email: string;
  senha_hash: string;
  tipo: TipoUsuario;
  cpf_cifrado: string;
  cpf_hash: string;
  oab: string | null;
  telefone: string | null;
  criado_em: Date;
}

@Injectable()
export class PostgresUsuarioRepository implements IUsuarioRepository {
  constructor(private readonly db: ContasDatabaseService) {}

  async existeEmail(email: string): Promise<boolean> {
    const r = await this.db.query('SELECT 1 FROM contas.usuarios WHERE email = $1', [email]);
    return (r.rowCount ?? 0) > 0;
  }

  async existeCpfHash(cpfHash: string): Promise<boolean> {
    const r = await this.db.query('SELECT 1 FROM contas.usuarios WHERE cpf_hash = $1', [cpfHash]);
    return (r.rowCount ?? 0) > 0;
  }

  async criar(u: Usuario): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO contas.usuarios
           (id, nome, email, senha_hash, tipo, cpf_cifrado, cpf_hash, oab, telefone, criado_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [u.id, u.nome, u.email, u.senhaHash, u.tipo, u.cpfCifrado, u.cpfHash, u.oab, u.telefone, u.criadoEm],
      );
    } catch (erro) {
      // 23505 = violação de UNIQUE. Acontece se dois cadastros iguais chegam juntos
      // e os dois passam pela checagem antes de qualquer um gravar.
      if ((erro as { code?: string }).code === '23505') {
        throw new Conflito('E-mail ou CPF já cadastrado');
      }
      throw erro;
    }
  }

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const r = await this.db.query<LinhaUsuario>('SELECT * FROM contas.usuarios WHERE email = $1', [email]);
    const l = r.rows[0];
    if (!l) return null;
    return new Usuario({
      id: l.id,
      nome: l.nome,
      email: l.email,
      senhaHash: l.senha_hash,
      tipo: l.tipo,
      cpfCifrado: l.cpf_cifrado,
      cpfHash: l.cpf_hash,
      oab: l.oab,
      telefone: l.telefone,
      criadoEm: new Date(l.criado_em),
    });
  }
}
