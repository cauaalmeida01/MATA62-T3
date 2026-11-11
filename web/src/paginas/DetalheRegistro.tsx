import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Erro, formatarData, useCarregar } from '../componentes/base';
import { SeloCarimbo } from '../componentes/SeloCarimbo';
import { useSessao } from '../sessao';

const TAMANHO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const formatarTamanho = (b: number) => (b < 1024 * 1024 ? `${TAMANHO.format(b / 1024)} KB` : `${TAMANHO.format(b / 1024 / 1024)} MB`);

/** REQ13 — Detalhes do registro, apresentados como uma certidão. */
export function DetalheRegistro() {
  const { id } = useParams();
  const { api } = useSessao();
  const { dados: r, erro } = useCarregar((t) => api.detalharRegistro(t, id!), [id]);

  return (
    <div>
      <Link to="/registros" className="text-sm text-apagado underline-offset-4 hover:underline">
        Voltar aos registros
      </Link>
      <div className="mt-6">
        <Erro erro={erro} />
        {!r && !erro && <p className="text-apagado">Carregando…</p>}
      </div>

      {r && (
        <article className="border border-tinta bg-white px-5 py-8 sm:px-10 sm:py-10">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-linha pb-6">
            <div className="min-w-0">
              <p className="text-sm text-apagado">Certidão de registro</p>
              <h1 className="mt-1 font-titulo text-2xl font-semibold leading-snug sm:text-3xl">{r.titulo || 'Sem título'}</h1>
              <a href={r.url} target="_blank" rel="noreferrer noopener" className="mt-2 block break-all text-sm underline underline-offset-4">
                {r.url}
              </a>
            </div>
            <Selo horario={r.carimbo.horario} />
          </header>

          <dl className="grid gap-x-8 gap-y-4 border-b border-linha py-6 sm:grid-cols-2">
            <Item termo="Início da captura">{formatarData(r.inicio)}</Item>
            <Item termo="Fim da captura">{formatarData(r.fim)}</Item>
            <Item termo="Carimbo do tempo">
              <span className="flex flex-wrap items-center gap-2">
                {formatarData(r.carimbo.horario)} <SeloCarimbo fonte={r.carimbo.fonte} />
              </span>
            </Item>
            <Item termo="Número do registro">
              <span className="font-hash text-sm">{r.id}</span>
            </Item>
          </dl>

          {r.carimbo.fonte === 'RELOGIO_LOCAL' && (
            <p className="mt-6 bg-alerta-claro px-4 py-3 text-sm text-alerta">
              A autoridade de carimbo do tempo não respondeu no momento da captura. A hora deste registro veio do relógio do
              servidor e não tem o atestado de um terceiro.
            </p>
          )}

          <section className="py-6">
            <h2 className="font-titulo text-xl font-semibold">Evidências</h2>
            <p className="mt-1 text-sm text-apagado">
              Qualquer alteração em um arquivo muda o seu SHA-256. Compare com estes valores para conferir a integridade.
            </p>
            <ul className="mt-4 divide-y divide-linha border-y border-linha">
              {r.arquivos.map((a) => (
                <li key={a.nome} className="py-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{a.nome}</span>
                    <span className="text-sm text-apagado">{formatarTamanho(a.tamanhoBytes)}</span>
                  </div>
                  <Hash valor={a.sha256} />
                </li>
              ))}
            </ul>
          </section>

          <footer className="border-t border-tinta pt-4">
            <p className="text-sm font-medium">SHA-256 do manifesto</p>
            <Hash valor={r.manifestoSha256} />
          </footer>
        </article>
      )}
    </div>
  );
}

function Item({ termo, children }: { termo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-apagado">{termo}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function Hash({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* sem permissão de área de transferência: o hash continua selecionável */
    }
  }
  return (
    <div className="mt-1 flex items-start gap-3">
      <code className="min-w-0 flex-1 break-all font-hash text-xs leading-relaxed text-tinta/80">{valor}</code>
      <button onClick={copiar} className="shrink-0 text-xs text-apagado underline-offset-4 hover:underline">
        {copiado ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

/** O selo da certidão: o elemento visual marcante da interface. */
function Selo({ horario }: { horario: string }) {
  const data = new Date(horario);
  const dia = data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24 shrink-0 text-selo sm:h-28 sm:w-28" role="img" aria-label={`Selo de registro de ${dia}`}>
      <defs>
        <path id="arco" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="1" />
      <text fontSize="9.5" letterSpacing="1.6" fill="currentColor" fontFamily="Public Sans, sans-serif">
        <textPath href="#arco">VERIDIT · REGISTRO COM VALOR DE PROVA ·</textPath>
      </text>
      <text x="60" y="57" textAnchor="middle" fontSize="11" fill="currentColor" fontFamily="Literata, serif" fontWeight="600">
        Registrado
      </text>
      <text x="60" y="71" textAnchor="middle" fontSize="9.5" fill="currentColor" fontFamily="Public Sans, sans-serif">
        {dia}
      </text>
    </svg>
  );
}
