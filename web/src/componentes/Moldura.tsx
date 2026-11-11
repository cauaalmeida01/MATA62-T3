import { Link, Outlet, useLocation } from 'react-router-dom';
import { useSessao } from '../sessao';
import { useCarregar } from './base';

/** Cabeçalho das telas logadas: marca, saldo de créditos e sair. */
export function Moldura() {
  const { api, sair } = useSessao();
  const { pathname } = useLocation();
  // Recarrega o saldo a cada troca de tela (ex.: depois de registrar uma página).
  const { dados: saldo } = useCarregar((t) => api.saldo(t), [pathname]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-linha">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/registros" className="font-titulo text-xl font-semibold">
            Veridit
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            {saldo && (
              <span className="text-apagado">
                {saldo.disponivel} {saldo.disponivel === 1 ? 'crédito' : 'créditos'}
              </span>
            )}
            <button onClick={() => void sair()} className="underline-offset-4 hover:underline">
              Sair
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <Outlet />
      </main>
    </div>
  );
}

/** Coluna estreita das telas de entrada (login e cadastro). */
export function MolduraEntrada({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="font-titulo text-xl font-semibold">Veridit</p>
      <p className="mb-10 text-apagado">Registre páginas da internet com valor de prova.</p>
      {children}
    </main>
  );
}
