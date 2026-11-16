import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { criarApiFalsa } from './api/api-falsa';
import { criarApiHttp } from './api/api-http';
import { VeriditApi } from './api/tipos';

/** Escolhe a implementação da API num lugar só (raiz de composição do front). */
const api: VeriditApi = import.meta.env.VITE_API_MOCK === 'true' ? criarApiFalsa() : criarApiHttp();

interface ContextoSessao {
  api: VeriditApi;
  token: string | null;
  entrar(email: string, senha: string): Promise<void>;
  sair(): Promise<void>;
  /** Muda sempre que uma tela altera o saldo, para o cabeçalho recarregá-lo. */
  versaoSaldo: number;
  saldoMudou(): void;
}

const Contexto = createContext<ContextoSessao | null>(null);
const CHAVE = 'veridit.token';

function lerToken() {
  try {
    return sessionStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(lerToken);
  const [versaoSaldo, setVersaoSaldo] = useState(0);
  const saldoMudou = useCallback(() => setVersaoSaldo((v) => v + 1), []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const sessao = await api.entrar(email, senha);
    try {
      sessionStorage.setItem(CHAVE, sessao.token);
    } catch {
      /* sem storage: a sessão vale só enquanto a página estiver aberta */
    }
    setToken(sessao.token);
  }, []);

  const sair = useCallback(async () => {
    if (token) await api.sair(token).catch(() => undefined);
    try {
      sessionStorage.removeItem(CHAVE);
    } catch {
      /* nada a limpar */
    }
    setToken(null);
  }, [token]);

  const valor = useMemo(() => ({ api, token, entrar, sair, versaoSaldo, saldoMudou }), [token, entrar, sair, versaoSaldo, saldoMudou]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useSessao fora do ProvedorSessao');
  return ctx;
}
