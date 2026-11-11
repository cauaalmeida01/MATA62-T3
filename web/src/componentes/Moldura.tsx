import { ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSessao } from '../sessao';
import { useCarregar } from './base';
import { IconeGlobo, IconeHash, IconeLista, IconeMoedas, IconeSair, Marca } from './icones';

/** Cabeçalho das telas logadas: marca, navegação, saldo de créditos e sair. */
export function Moldura() {
  const { api, sair, versaoSaldo } = useSessao();
  const { pathname } = useLocation();
  // Recarrega o saldo a cada troca de tela (ex.: depois de registrar uma página).
  const { dados: saldo } = useCarregar((t) => api.saldo(t), [pathname, versaoSaldo]);

  const aba = ({ isActive }: { isActive: boolean }) =>
    `relative py-5 text-[15px] ${isActive ? 'font-semibold text-texto after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-laranja' : 'text-apagado hover:text-texto'}`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-borda bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-10 gap-y-2 px-4 sm:px-6">
          <Link to="/registros" className="py-3">
            <Marca />
          </Link>
          <nav className="order-3 flex gap-8 sm:order-none">
            <NavLink to="/registros" end className={aba}>
              Meus registros
            </NavLink>
            <NavLink to="/registros/novo" className={aba}>
              Novo registro
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-5">
            {saldo && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-laranja-claro px-3.5 py-1.5 text-sm font-semibold text-laranja">
                <IconeMoedas width={16} height={16} />
                {saldo.disponivel} {saldo.disponivel === 1 ? 'crédito' : 'créditos'}
              </span>
            )}
            <button onClick={() => void sair()} className="inline-flex items-center gap-1.5 text-sm text-apagado hover:text-texto">
              <IconeSair width={16} height={16} />
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}

/** Telas de entrada (login e cadastro): painel azul à esquerda, formulário à direita. */
export function MolduraEntrada({ children }: { children: ReactNode }) {
  const pontos = [
    { icone: <IconeGlobo />, texto: 'Captura em navegador isolado no servidor' },
    { icone: <IconeHash />, texto: 'Hash SHA-256 e carimbo do tempo' },
    { icone: <IconeLista />, texto: 'Registros consultáveis com os hashes de cada arquivo' },
  ];

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="flex flex-col bg-marinho px-6 py-8 text-white sm:px-14 sm:py-12">
        <Marca claro />
        <div className="my-10 lg:my-auto">
          <p className="text-3xl font-bold leading-tight sm:text-[40px]">Registre conteúdo da web com valor de prova.</p>
          <p className="mt-5 max-w-md text-white/75">
            Capture telas em um ambiente controlado e receba evidências com hash e carimbo do tempo.
          </p>
          <ul className="mt-10 hidden space-y-4 sm:block">
            {pontos.map((p) => (
              <li key={p.texto} className="flex items-center gap-3 text-[15px]">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">{p.icone}</span>
                {p.texto}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="flex items-center justify-center px-4 py-12 sm:px-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
