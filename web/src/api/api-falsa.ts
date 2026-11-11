import { ErroApi, RegistroDetalhe, StatusSolicitacao, VeriditApi } from './tipos';

/**
 * API em memória para desenvolver o front sem o back (npm run dev:mock).
 * Simula o fluxo do contrato: a solicitação passa por PENDENTE e PROCESSANDO e vira um registro.
 */
export function criarApiFalsa(): VeriditApi {
  const usuarios = new Map<string, { senha: string; creditos: number }>();
  const tokens = new Map<string, string>(); // token -> email
  const registros = new Map<string, RegistroDetalhe & { dono: string }>();
  const solicitacoes = new Map<string, { dono: string; url: string; titulo: string; criadaEm: number }>();

  const espera = () => new Promise((r) => setTimeout(r, 250));
  const hash = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');

  function dono(token: string) {
    const email = tokens.get(token);
    if (!email) throw new ErroApi(401, 'HTTP_401', 'Sessão expirada. Entre de novo.');
    return email;
  }

  function avancar(id: string): StatusSolicitacao {
    const s = solicitacoes.get(id)!;
    const passou = Date.now() - s.criadaEm;
    if (passou < 1500) return 'PENDENTE';
    if (passou < 4000) return 'PROCESSANDO';
    if (!registros.has(id)) {
      const agora = new Date();
      registros.set(id, {
        id,
        dono: s.dono,
        solicitacaoId: id,
        evidenciaId: crypto.randomUUID(),
        url: s.url,
        titulo: s.titulo,
        inicio: new Date(s.criadaEm).toISOString(),
        fim: agora.toISOString(),
        carimbo: { fonte: registros.size % 3 === 2 ? 'RELOGIO_LOCAL' : 'FREETSA', horario: agora.toISOString() },
        criadoEm: agora.toISOString(),
        manifestoSha256: hash(),
        arquivos: [
          { nome: 'tela-1.png', tipo: 'TELA', sha256: hash(), tamanhoBytes: 482_113 },
          { nome: 'rede.har', tipo: 'HAR', sha256: hash(), tamanhoBytes: 1_204_558 },
        ],
      });
    }
    return 'CONCLUIDA';
  }

  return {
    async cadastrar(dados) {
      await espera();
      if (usuarios.has(dados.email)) throw new ErroApi(409, 'CONFLITO', 'Já existe uma conta com este e-mail');
      usuarios.set(dados.email, { senha: dados.senha, creditos: 5 });
    },
    async entrar(email, senha) {
      await espera();
      if (usuarios.get(email)?.senha !== senha) throw new ErroApi(401, 'HTTP_401', 'E-mail ou senha incorretos');
      const token = crypto.randomUUID();
      tokens.set(token, email);
      return { token, expiraEm: new Date(Date.now() + 3_600_000).toISOString() };
    },
    async sair(token) {
      tokens.delete(token);
    },
    async saldo(token) {
      return { disponivel: usuarios.get(dono(token))!.creditos, reservado: 0 };
    },
    async solicitarRegistro(token, url, titulo) {
      await espera();
      const email = dono(token);
      const usuario = usuarios.get(email)!;
      if (usuario.creditos < 1) throw new ErroApi(402, 'CREDITOS_INSUFICIENTES', 'Sem créditos disponíveis');
      usuario.creditos -= 1;
      const id = crypto.randomUUID();
      solicitacoes.set(id, { dono: email, url, titulo, criadaEm: Date.now() });
      return { solicitacaoId: id, status: 'PENDENTE' };
    },
    async statusSolicitacao(token, id) {
      dono(token);
      if (!solicitacoes.has(id)) throw new ErroApi(404, 'NAO_ENCONTRADO', 'Solicitação não encontrada');
      return { solicitacaoId: id, status: avancar(id) };
    },
    async listarRegistros(token) {
      await espera();
      const email = dono(token);
      return [...registros.values()].filter((r) => r.dono === email).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    },
    async detalharRegistro(token, id) {
      await espera();
      const r = registros.get(id);
      if (!r || r.dono !== dono(token)) throw new ErroApi(404, 'NAO_ENCONTRADO', 'Registro não encontrado');
      return r;
    },
  };
}
