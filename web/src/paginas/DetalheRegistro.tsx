import { ReactNode, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Cabecalho,
  Cartao,
  Erro,
  Etiqueta,
  formatarData,
  formatarDuracao,
  formatarTamanho,
  textoCarimbo,
  useCarregar,
} from '../componentes/base';
import { IconeAlerta, IconeCamera, IconeEscudo } from '../componentes/icones';
import { useSessao } from '../sessao';

const TIPOS_ARQUIVO: Record<string, string> = { TELA: 'Imagem', HAR: 'Tráfego de rede (HAR)', MANIFESTO: 'Manifesto' };

/** REQ13 — Detalhes do registro: informações, arquivos com hashes e dados da selagem. */
export function DetalheRegistro() {
  const { id } = useParams();
  const { api } = useSessao();
  const { dados: r, erro } = useCarregar((t) => api.detalharRegistro(t, id!), [id]);
  const trilha = (
    <>
      <Link to="/registros" className="hover:underline">
        Meus registros
      </Link>{' '}
      / Detalhes
    </>
  );

  if (!r) {
    return (
      <>
        <Cabecalho trilha={trilha} titulo="Detalhes do registro" />
        <Erro erro={erro} />
        {!erro && <p className="text-apagado">Carregando…</p>}
      </>
    );
  }

  const imagens = r.arquivos.filter((a) => a.tipo === 'TELA').length;
  const localSemTerceiro = r.carimbo.fonte === 'RELOGIO_LOCAL';

  return (
    <>
      <Cabecalho trilha={trilha} titulo={r.titulo || 'Sem título'} />
      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-3 text-sm text-apagado">
        <Etiqueta tom="sucesso">Concluído</Etiqueta>
        <span>
          ID do registro: <span className="font-hash">{r.id}</span>
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao className="p-6">
          <h2 className="text-lg font-bold">Informações</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Dado termo="Título">{r.titulo || 'Sem título'}</Dado>
            <Dado termo="Início">{formatarData(r.inicio)}</Dado>
            <Dado termo="Fim">{formatarData(r.fim)}</Dado>
            <Dado termo="Duração">{formatarDuracao(r.inicio, r.fim)}</Dado>
          </dl>
        </Cartao>

        <Cartao className="p-6">
          <h2 className="text-lg font-bold">Dados registrados</h2>
          <div className="mt-4 flex items-center gap-4 rounded-lg bg-cabecalho-tabela px-4 py-3 sm:max-w-[260px]">
            <IconeCamera className="text-apagado" />
            <span className="text-2xl font-bold">{imagens}</span>
            <span className="text-sm text-apagado">{imagens === 1 ? 'imagem capturada' : 'imagens capturadas'}</span>
          </div>
          <p className="mt-4 text-sm text-apagado">Site navegado</p>
          <a href={r.url} target="_blank" rel="noreferrer noopener" className="mt-0.5 block break-all text-sm font-semibold hover:underline">
            {r.url}
          </a>
        </Cartao>
      </div>

      <Cartao className="mt-6 overflow-hidden">
        <h2 className="px-6 pb-3 pt-5 text-lg font-bold">Arquivos</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-cabecalho-tabela text-xs font-semibold text-texto/80">
              <tr>
                <th className="px-6 py-3">Nome do arquivo gerado</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Tamanho</th>
                <th className="px-6 py-3">SHA-256</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {r.arquivos.map((a) => (
                <tr key={a.nome}>
                  <td className="px-6 py-3 font-semibold">{a.nome}</td>
                  <td className="px-4 py-3 text-apagado">{TIPOS_ARQUIVO[a.tipo] ?? a.tipo}</td>
                  <td className="px-4 py-3 text-apagado">{formatarTamanho(a.tamanhoBytes)}</td>
                  <td className="px-6 py-3">
                    <Hash valor={a.sha256} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>

      <section className={`mt-6 rounded-lg border px-6 py-5 ${localSemTerceiro ? 'border-alerta/30 bg-alerta-claro' : 'border-sucesso/25 bg-sucesso-claro'}`}>
        <div className="flex gap-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${localSemTerceiro ? 'bg-alerta' : 'bg-sucesso'}`}>
            {localSemTerceiro ? <IconeAlerta /> : <IconeEscudo />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className={`font-bold ${localSemTerceiro ? 'text-alerta' : 'text-sucesso'}`}>
              {localSemTerceiro ? 'Evidência selada com hora local' : 'Evidência selada e verificável'}
            </h2>
            <p className="mt-0.5 text-sm text-texto/75">
              {localSemTerceiro
                ? 'A autoridade de carimbo do tempo não respondeu na hora da captura. A hora veio do relógio do servidor, sem o atestado de um terceiro.'
                : 'Qualquer alteração em um dos arquivos muda o seu hash e deixa de conferir com o manifesto.'}
            </p>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-apagado">Hash do manifesto</dt>
                <dd className="mt-0.5 font-semibold">
                  <Hash valor={r.manifestoSha256} />
                </dd>
              </div>
              <div>
                <dt className="text-apagado">Carimbo do tempo</dt>
                <dd className="mt-0.5 font-semibold">
                  {formatarData(r.carimbo.horario)} · {textoCarimbo(r.carimbo.fonte)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}

function Dado({ termo, children }: { termo: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3">
      <dt className="text-apagado">{termo}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

/** Hash abreviado como no protótipo (início…fim), com o valor completo para copiar. */
function Hash({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* sem permissão de área de transferência */
    }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <code className="font-hash text-xs font-normal" title={valor}>
        {valor.slice(0, 24)}…{valor.slice(-4)}
      </code>
      <button onClick={copiar} className="text-xs font-normal text-apagado hover:text-texto hover:underline">
        {copiado ? 'Copiado' : 'Copiar'}
      </button>
    </span>
  );
}
