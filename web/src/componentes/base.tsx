import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, useEffect, useState } from 'react';
import { ErroApi } from '../api/tipos';
import { useSessao } from '../sessao';

export function Campo({ rotulo, ajuda, ...props }: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; ajuda?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{rotulo}</span>
      <input
        {...props}
        className="mt-1 block w-full rounded-sm border border-linha bg-white px-3 py-2 text-base placeholder:text-apagado/70 focus:border-tinta focus:outline-none"
      />
      {ajuda && <span className="mt-1 block text-sm text-apagado">{ajuda}</span>}
    </label>
  );
}

export function Botao({ carregando, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { carregando?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || carregando}
      className="rounded-sm bg-tinta px-5 py-2.5 font-medium text-papel hover:bg-tinta/90 disabled:cursor-wait disabled:opacity-60"
    >
      {carregando ? 'Aguarde…' : children}
    </button>
  );
}

export function Erro({ erro }: { erro: unknown }) {
  if (!erro) return null;
  const mensagem = erro instanceof Error ? erro.message : 'Algo deu errado. Tente de novo.';
  return (
    <p role="alert" className="border-l-2 border-erro bg-erro/5 px-3 py-2 text-sm text-erro">
      {mensagem}
    </p>
  );
}

/** Carrega dados do back; se o token expirou (401), encerra a sessão e volta ao login. */
export function useCarregar<T>(buscar: (token: string) => Promise<T>, deps: unknown[]) {
  const { token, sair } = useSessao();
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<unknown>(null);

  useEffect(() => {
    if (!token) return;
    let ativo = true;
    setErro(null);
    buscar(token)
      .then((d) => ativo && setDados(d))
      .catch((e) => {
        if (!ativo) return;
        if (e instanceof ErroApi && e.status === 401) void sair();
        else setErro(e);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, ...deps]);

  return { dados, erro };
}

export function Pagina({ titulo, children, acao }: { titulo: string; children: ReactNode; acao?: ReactNode }) {
  return (
    <section>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-titulo text-3xl font-semibold leading-tight sm:text-4xl">{titulo}</h1>
        {acao}
      </div>
      {children}
    </section>
  );
}

const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' });
export const formatarData = (iso: string) => DATA.format(new Date(iso));
