import { Inject, Injectable } from '@nestjs/common';
import { RegistroNaoEncontrado } from '../dominio/erros';
import { REGISTRO_REPOSITORIO, RegistroRepositorio } from '../dominio/portas';
import { DadosRegistro } from '../dominio/registro';

/** REQ12 — Listar registros (comp. 18 Consulta): só os do próprio usuário, mais novos primeiro. */
@Injectable()
export class ListarRegistros {
  constructor(@Inject(REGISTRO_REPOSITORIO) private readonly registros: RegistroRepositorio) {}

  async executar(userId: string): Promise<DadosRegistro[]> {
    const lista = await this.registros.listarPorUsuario(userId);
    return lista.map((r) => r.paraDados());
  }
}

/**
 * REQ13 — Detalhes do registro (comp. 18 Consulta).
 * Registro de outro usuário responde "não encontrado", e não "acesso negado",
 * para não revelar que aquele id existe.
 */
@Injectable()
export class DetalharRegistro {
  constructor(@Inject(REGISTRO_REPOSITORIO) private readonly registros: RegistroRepositorio) {}

  async executar(id: string, userId: string): Promise<DadosRegistro> {
    const registro = await this.registros.buscarPorId(id);
    if (!registro || !registro.pertenceA(userId)) throw new RegistroNaoEncontrado();
    return registro.paraDados();
  }
}
