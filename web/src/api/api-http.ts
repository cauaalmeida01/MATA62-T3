import { ErroApi, VeriditApi } from './tipos';

/** Implementação real: fala com o Nginx (rotas públicas de docs/contratos.md). */
export function criarApiHttp(base = '/api'): VeriditApi {
  async function chamar<T>(caminho: string, opcoes: { metodo?: string; token?: string; corpo?: unknown } = {}): Promise<T> {
    const resposta = await fetch(`${base}${caminho}`, {
      method: opcoes.metodo ?? 'GET',
      headers: {
        ...(opcoes.corpo !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(opcoes.token ? { authorization: `Bearer ${opcoes.token}` } : {}),
      },
      body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
    });

    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => null);
      throw new ErroApi(resposta.status, corpo?.erro?.codigo ?? 'ERRO_INTERNO', corpo?.erro?.mensagem ?? 'Não foi possível falar com o servidor');
    }
    if (resposta.status === 204) return undefined as T;
    const texto = await resposta.text();
    return (texto ? JSON.parse(texto) : undefined) as T;
  }

  return {
    cadastrar: (dados) => chamar('/contas', { metodo: 'POST', corpo: dados }),
    entrar: (email, senha) => chamar('/sessoes', { metodo: 'POST', corpo: { email, senha } }),
    sair: (token) => chamar('/sessoes/atual', { metodo: 'DELETE', token }),
    saldo: (token) => chamar('/creditos/saldo', { token }),
    solicitarRegistro: (token, url, titulo) => chamar('/solicitacoes', { metodo: 'POST', token, corpo: { url, titulo, modo: 'TELA' } }),
    statusSolicitacao: (token, id) => chamar(`/solicitacoes/${encodeURIComponent(id)}`, { token }),
    listarRegistros: (token) => chamar('/registros', { token }),
    detalharRegistro: (token, id) => chamar(`/registros/${encodeURIComponent(id)}`, { token }),
  };
}
