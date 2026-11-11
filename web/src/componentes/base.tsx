import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, useEffect, useState } from 'react';
import { ErroApi } from '../api/tipos';
import { useSessao } from '../sessao';

type PropsCampo = InputHTMLAttributes<HTMLInputElement> & { rotulo: string; ajuda?: string; icone?: ReactNode };

export function Campo({ rotulo, ajuda, icone, required, ...props }: PropsCampo) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-texto">
        {rotulo}
        {required && <span aria-hidden> *</span>}
      </span>
      <span className="relative mt-1.5 block">
        {icone && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-apagado">{icone}</span>}
        <input
          {...props}
          required={required}
          className={`block w-full rounded-md border border-borda bg-white py-2.5 pr-3 text-[15px] placeholder:text-apagado/70 focus:border-marinho focus:outline-none focus:ring-1 focus:ring-marinho ${icone ? 'pl-10' : 'pl-3'}`}
        />
      </span>
      {ajuda && <span className="mt-1 block text-xs text-apagado">{ajuda}</span>}
    </label>
  );
}

type Variante = 'primario' | 'destaque' | 'contorno';
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-marinho text-white hover:bg-marinho-escuro',
  destaque: 'bg-laranja text-white hover:bg-laranja/90',
  contorno: 'border border-borda bg-white text-texto hover:bg-fundo',
};

export function Botao({
  carregando,
  variante = 'primario',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { carregando?: boolean; variante?: Variante }) {
  return (
    <button
      {...props}
      disabled={props.disabled || carregando}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold disabled:cursor-wait disabled:opacity-60 ${VARIANTES[variante]} ${className}`}
    >
      {carregando ? 'Aguarde…' : children}
    </button>
  );
}

export const classeBotao = (variante: Variante = 'primario') =>
  `inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold ${VARIANTES[variante]}`;

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-borda bg-white ${className}`}>{children}</div>;
}

export function Erro({ erro }: { erro: unknown }) {
  if (!erro) return null;
  const mensagem = erro instanceof Error ? erro.message : 'Algo deu errado. Tente de novo.';
  return (
    <p role="alert" className="rounded-md bg-erro-claro px-3 py-2 text-sm text-erro">
      {mensagem}
    </p>
  );
}

type Tom = 'sucesso' | 'info' | 'alerta' | 'erro';
const TONS: Record<Tom, string> = {
  sucesso: 'bg-sucesso-claro text-sucesso',
  info: 'bg-info-claro text-info',
  alerta: 'bg-alerta-claro text-alerta',
  erro: 'bg-erro-claro text-erro',
};

/** Etiqueta de status com bolinha, como "● Concluído" no protótipo. */
export function Etiqueta({ tom, children }: { tom: Tom; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONS[tom]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
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

export function Cabecalho({ titulo, subtitulo, acao, trilha }: { titulo: string; subtitulo?: string; acao?: ReactNode; trilha?: ReactNode }) {
  return (
    <div className="mb-6">
      {trilha && <div className="mb-2 text-sm text-apagado">{trilha}</div>}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold sm:text-[28px]">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-[15px] text-apagado">{subtitulo}</p>}
        </div>
        {acao}
      </div>
    </div>
  );
}

const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' });
export const formatarData = (iso: string) => DATA.format(new Date(iso));

const DATA_CURTA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
export const formatarDataCurta = (iso: string) => DATA_CURTA.format(new Date(iso));

export function formatarDuracao(inicio: string, fim: string) {
  const s = Math.max(0, Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
export const formatarTamanho = (b: number) => (b < 1024 * 1024 ? `${NUM.format(b / 1024)} KB` : `${NUM.format(b / 1024 / 1024)} MB`);

export const textoCarimbo = (fonte: string) => (fonte === 'FREETSA' ? 'FreeTSA (RFC 3161)' : 'Relógio local do servidor');
