import { Link } from 'react-router-dom';
import { Erro, formatarData, Pagina, useCarregar } from '../componentes/base';
import { SeloCarimbo } from '../componentes/SeloCarimbo';
import { useSessao } from '../sessao';

/** REQ12 — Listar registros do usuário, como as linhas de um livro de registro. */
export function Registros() {
  const { api } = useSessao();
  const { dados: registros, erro } = useCarregar((t) => api.listarRegistros(t), []);

  const novo = (
    <Link to="/registros/novo" className="rounded-sm bg-tinta px-5 py-2.5 font-medium text-papel hover:bg-tinta/90">
      Registrar uma página
    </Link>
  );

  return (
    <Pagina titulo="Seus registros" acao={novo}>
      <Erro erro={erro} />
      {!registros && !erro && <p className="text-apagado">Carregando…</p>}

      {registros?.length === 0 && (
        <div className="border border-dashed border-linha px-6 py-12 text-center">
          <p className="font-titulo text-xl">Nenhum registro ainda</p>
          <p className="mt-2 text-apagado">Cole o endereço de uma página para guardar uma cópia com data e hora certificadas.</p>
        </div>
      )}

      {registros && registros.length > 0 && (
        <ol className="border-t border-tinta">
          {registros.map((r) => (
            <li key={r.id} className="border-b border-linha">
              <Link to={`/registros/${r.id}`} className="grid gap-1 py-4 hover:bg-white sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6 sm:px-2">
                <span className="min-w-0">
                  <span className="block font-medium">{r.titulo || 'Sem título'}</span>
                  <span className="block truncate text-sm text-apagado">{r.url}</span>
                </span>
                <span className="flex items-center gap-3 text-sm text-apagado sm:justify-end">
                  {formatarData(r.carimbo.horario)}
                  <SeloCarimbo fonte={r.carimbo.fonte} compacto />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Pagina>
  );
}
