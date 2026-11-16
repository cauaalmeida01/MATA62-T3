import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cabecalho, Cartao, classeBotao, Erro, Etiqueta, formatarDataCurta, useCarregar } from '../componentes/base';
import { IconeBusca, IconeMais, IconeSeta } from '../componentes/icones';
import { useSessao } from '../sessao';

const PERIODOS = [
  { dias: 7, texto: 'Últimos 7 dias' },
  { dias: 30, texto: 'Últimos 30 dias' },
  { dias: 90, texto: 'Últimos 90 dias' },
  { dias: 0, texto: 'Todo o período' },
];
const POR_PAGINA = 10;

/** REQ12 — Listar registros concluídos do usuário. */
export function Registros() {
  const { api } = useSessao();
  const { dados: registros, erro } = useCarregar((t) => api.listarRegistros(t), []);
  const { dados: saldo } = useCarregar((t) => api.saldo(t), []);
  const [busca, setBusca] = useState('');
  const [periodo, setPeriodo] = useState(0);
  const [pagina, setPagina] = useState(1);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    const limite = periodo ? Date.now() - periodo * 86_400_000 : 0;
    return (registros ?? []).filter(
      (r) => (!termo || r.titulo.toLocaleLowerCase('pt-BR').includes(termo)) && new Date(r.inicio).getTime() >= limite,
    );
  }, [registros, busca, periodo]);

  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const atual = Math.min(pagina, paginas);
  const visiveis = filtrados.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);

  const novo = (
    <Link to="/registros/novo" className={classeBotao('destaque')}>
      <IconeMais width={16} height={16} /> Novo registro
    </Link>
  );

  return (
    <>
      <Cabecalho titulo="Meus registros" subtitulo="Consulte os registros concluídos e os detalhes de cada evidência." acao={novo} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Indicador rotulo="Registros concluídos" valor={registros?.length} cor="text-sucesso" />
        <Indicador rotulo="Créditos reservados" valor={saldo?.reservado} cor="text-info" ajuda="Registros ainda em processamento" />
        <Indicador rotulo="Créditos disponíveis" valor={saldo?.disponivel} cor="text-laranja" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <label className="block">
          <span className="text-sm font-medium">Buscar</span>
          <span className="relative mt-1.5 block">
            <IconeBusca className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-apagado" />
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
              placeholder="Buscar por título"
              className="block w-full rounded-md border border-borda bg-white py-2.5 pl-10 pr-3 text-[15px] focus:border-marinho focus:outline-none"
            />
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Período</span>
          <select
            value={periodo}
            onChange={(e) => {
              setPeriodo(Number(e.target.value));
              setPagina(1);
            }}
            className="mt-1.5 block w-full rounded-md border border-borda bg-white px-3 py-2.5 text-[15px] focus:border-marinho focus:outline-none"
          >
            {PERIODOS.map((p) => (
              <option key={p.dias} value={p.dias}>
                {p.texto}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6">
        <Erro erro={erro} />
      </div>

      <Cartao className="mt-2 overflow-hidden">
        {!registros && !erro && <p className="px-6 py-10 text-center text-apagado">Carregando…</p>}

        {registros && filtrados.length === 0 && (
          <div className="px-6 py-14 text-center">
            <p className="font-semibold">{registros.length === 0 ? 'Nenhum registro ainda' : 'Nenhum registro encontrado'}</p>
            <p className="mt-1 text-sm text-apagado">
              {registros.length === 0 ? 'Informe o endereço de uma página para registrar o conteúdo com valor de prova.' : 'Ajuste a busca ou o período.'}
            </p>
            {registros.length === 0 && <div className="mt-5">{novo}</div>}
          </div>
        )}

        {visiveis.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-cabecalho-tabela text-xs font-semibold text-texto/80">
                <tr>
                  <th className="px-6 py-3">Título</th>
                  <th className="px-4 py-3">Início</th>
                  <th className="px-4 py-3">Fim</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-6 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {visiveis.map((r) => (
                  <tr key={r.id}>
                    <td className="px-6 py-4 font-semibold">{r.titulo || 'Sem título'}</td>
                    <td className="px-4 py-4 text-apagado">{formatarDataCurta(r.inicio)}</td>
                    <td className="px-4 py-4 text-apagado">{formatarDataCurta(r.fim)}</td>
                    <td className="px-4 py-4">
                      <Etiqueta tom="sucesso">Concluído</Etiqueta>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/registros/${r.id}`} className="inline-flex items-center gap-1 font-semibold text-marinho hover:underline">
                        Ver detalhes <IconeSeta width={16} height={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      {filtrados.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-apagado">
          <span>
            Mostrando {visiveis.length} de {filtrados.length} {filtrados.length === 1 ? 'registro' : 'registros'}
          </span>
          {paginas > 1 && (
            <nav className="flex items-center gap-3 font-semibold text-texto" aria-label="Páginas">
              <button disabled={atual === 1} onClick={() => setPagina(atual - 1)} className="disabled:text-apagado/50">
                Anterior
              </button>
              {Array.from({ length: paginas }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => setPagina(n)} aria-current={n === atual ? 'page' : undefined} className={n === atual ? 'text-laranja' : ''}>
                  {n}
                </button>
              ))}
              <button disabled={atual === paginas} onClick={() => setPagina(atual + 1)} className="disabled:text-apagado/50">
                Próxima
              </button>
            </nav>
          )}
        </div>
      )}
    </>
  );
}

function Indicador({ rotulo, valor, cor, ajuda }: { rotulo: string; valor?: number; cor: string; ajuda?: string }) {
  return (
    <Cartao className="px-5 py-4">
      <p className="text-sm text-apagado">{rotulo}</p>
      <p className={`mt-1 text-3xl font-bold ${cor}`}>{valor ?? '–'}</p>
      {ajuda && <p className="mt-1 text-xs text-apagado">{ajuda}</p>}
    </Cartao>
  );
}
