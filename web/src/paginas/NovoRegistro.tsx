import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ErroApi, StatusSolicitacao } from '../api/tipos';
import { Botao, Cabecalho, Campo, Cartao, classeBotao, Erro, Etiqueta, useCarregar } from '../componentes/base';
import { IconeCamera, IconeCheck, IconeEscudo, IconeGirar, IconeGlobo, IconeMoedas, IconeSeta } from '../componentes/icones';
import { useSessao } from '../sessao';

/** REQ08 — Iniciar registro (captura de tela). Depois acompanha a solicitação até a conclusão (REQ11). */
export function NovoRegistro() {
  const { api, token, saldoMudou } = useSessao();
  const { dados: saldo } = useCarregar((t) => api.saldo(t), []);
  const [solicitacao, setSolicitacao] = useState<{ id: string; titulo: string; status: StatusSolicitacao } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);

  // Clicar em "Novo registro" no menu durante o acompanhamento volta para o formulário.
  const { key: navegacao } = useLocation();
  useEffect(() => setSolicitacao(null), [navegacao]);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const titulo = String(f.get('titulo')).trim();
    setCarregando(true);
    setErro(null);
    try {
      const s = await api.solicitarRegistro(token!, String(f.get('url')).trim(), titulo);
      setSolicitacao({ id: s.solicitacaoId, titulo, status: s.status });
      saldoMudou();
    } catch (falha) {
      setErro(
        falha instanceof ErroApi && falha.codigo === 'CREDITOS_INSUFICIENTES'
          ? new Error('Você não tem créditos disponíveis para um novo registro.')
          : falha,
      );
    } finally {
      setCarregando(false);
    }
  }

  if (solicitacao) return <Acompanhamento {...solicitacao} aoTentarDeNovo={() => setSolicitacao(null)} />;

  const disponivel = saldo?.disponivel;
  return (
    <>
      <Cabecalho titulo="Novo registro" subtitulo="Informe o site que será registrado." />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Cartao className="p-6 sm:p-7">
          <form onSubmit={enviar} className="space-y-5">
            <Campo rotulo="Endereço do site" name="url" type="url" placeholder="https://www.exemplo.com.br/publicacao/12345" required icone={<IconeGlobo />} />
            <Campo rotulo="Título do registro" name="titulo" required ajuda="Usado na listagem e nos detalhes do registro." />

            <div>
              <p className="text-sm font-medium">O que será registrado</p>
              <div className="mt-1.5 flex items-start gap-4 rounded-lg border border-laranja bg-laranja-claro p-4 sm:max-w-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-laranja text-white">
                  <IconeCamera />
                </span>
                <div>
                  <p className="font-semibold">Captura de tela</p>
                  <p className="mt-1 text-sm text-texto/75">Imagem da página no estado atual.</p>
                  <p className="mt-2 text-sm font-semibold text-laranja">1 crédito</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 rounded-lg bg-cabecalho-tabela p-4 text-sm">
              <IconeEscudo className="mt-0.5 shrink-0 text-marinho" />
              <div>
                <p className="font-semibold">Como a captura funciona</p>
                <p className="mt-1 text-texto/75">
                  A página é aberta em um navegador do Veridit, isolado no servidor. Ao concluir, cada arquivo recebe um hash
                  SHA-256 e o conjunto recebe um carimbo do tempo.
                </p>
              </div>
            </div>

            <Erro erro={erro} />
            <div className="flex items-center gap-6">
              <Botao type="submit" variante="destaque" carregando={carregando}>
                <IconeSeta width={16} height={16} /> Iniciar registro
              </Botao>
              <Link to="/registros" className="text-sm font-semibold hover:underline">
                Cancelar
              </Link>
            </div>
          </form>
        </Cartao>

        <Cartao className="p-6">
          <h2 className="text-lg font-bold">Créditos</h2>
          <dl className="mt-4 space-y-3 border-b border-borda pb-4 text-sm">
            <Linha termo="Saldo disponível">{disponivel ?? '–'}</Linha>
            <Linha termo="Reserva para este registro">
              <span className="text-laranja">− 1</span>
            </Linha>
            <Linha termo="Saldo após reserva">{disponivel !== undefined ? Math.max(0, disponivel - 1) : '–'}</Linha>
          </dl>
          <p className="mt-4 text-sm text-apagado">
            Os créditos só são consumidos quando o registro é concluído. Se a captura falhar, a reserva volta para o seu saldo.
          </p>
        </Cartao>
      </div>
    </>
  );
}

function Linha({ termo, children }: { termo: string; children: ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-apagado">{termo}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

/** As etapas que o status da solicitação (contrato) permite acompanhar. */
const ETAPAS: { status: StatusSolicitacao; titulo: string; descricao: string }[] = [
  { status: 'PENDENTE', titulo: 'Pedido recebido', descricao: 'Aguardando um navegador livre na fila' },
  { status: 'PROCESSANDO', titulo: 'Captura e selagem', descricao: 'Capturando a página, calculando os hashes e pedindo o carimbo do tempo' },
  { status: 'CONCLUIDA', titulo: 'Registro concluído', descricao: 'Evidências seladas e disponíveis nos seus registros' },
];

function Acompanhamento({ id, titulo, status: inicial, aoTentarDeNovo }: { id: string; titulo: string; status: StatusSolicitacao; aoTentarDeNovo: () => void }) {
  const { api, token, saldoMudou } = useSessao();
  const [status, setStatus] = useState(inicial);
  const terminou = status === 'CONCLUIDA' || status === 'FALHOU';

  // Ao concluir (crédito consumido) ou falhar (crédito devolvido), o saldo muda.
  useEffect(() => {
    if (terminou) saldoMudou();
  }, [terminou, saldoMudou]);

  // Consulta o status a cada 2 s até concluir ou falhar.
  useEffect(() => {
    if (terminou) return;
    const timer = setInterval(async () => {
      try {
        setStatus((await api.statusSolicitacao(token!, id)).status);
      } catch {
        /* falha de rede momentânea: tenta de novo no próximo ciclo */
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [api, token, id, terminou]);

  const indice = ETAPAS.findIndex((e) => e.status === status);
  const etiqueta =
    status === 'CONCLUIDA' ? <Etiqueta tom="sucesso">Concluído</Etiqueta> : status === 'FALHOU' ? <Etiqueta tom="erro">Falhou</Etiqueta> : <Etiqueta tom="info">Selando</Etiqueta>;

  return (
    <>
      <Cabecalho
        trilha={<><Link to="/registros" className="hover:underline">Meus registros</Link> / {titulo}</>}
        titulo={status === 'FALHOU' ? 'Não foi possível registrar' : status === 'CONCLUIDA' ? 'Registro concluído' : 'Selando sua evidência'}
        subtitulo={status === 'FALHOU' ? undefined : 'Você pode sair desta tela; o registro continua sendo processado.'}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Cartao className="relative p-6 sm:p-8">
          <div className="absolute right-6 top-6">{etiqueta}</div>
          {status === 'FALHOU' ? (
            <div className="max-w-lg space-y-4 pr-20">
              <p>A página não pôde ser capturada depois de três tentativas. Confira se o endereço está correto e se a página está no ar.</p>
              <p className="text-sm text-apagado">O crédito reservado foi devolvido ao seu saldo.</p>
              <Botao onClick={aoTentarDeNovo}>Tentar de novo</Botao>
            </div>
          ) : (
            <ol aria-live="polite">
              {ETAPAS.map((etapa, i) => {
                const feito = i < indice || status === 'CONCLUIDA';
                const andando = i === indice && !feito;
                return (
                  <li key={etapa.status} className="relative flex gap-4 pb-8 last:pb-0">
                    {i < ETAPAS.length - 1 && <span className={`absolute left-[17px] top-9 h-[calc(100%-36px)] w-0.5 ${feito ? 'bg-sucesso' : 'bg-borda'}`} aria-hidden />}
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        feito ? 'bg-sucesso text-white' : andando ? 'bg-info text-white' : 'border-2 border-borda bg-white'
                      }`}
                    >
                      {feito ? <IconeCheck width={18} height={18} /> : andando ? <IconeGirar width={18} height={18} className="animate-spin [animation-duration:2s]" /> : null}
                    </span>
                    <div className={`pt-1 ${!feito && !andando ? 'text-apagado' : ''}`}>
                      <p className="font-semibold">{etapa.titulo}</p>
                      <p className="mt-0.5 text-sm text-apagado">{etapa.descricao}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Cartao>

        <div className="space-y-6">
          <Cartao className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <IconeMoedas className="text-laranja" /> Créditos
            </h2>
            <p className="mt-3 text-sm text-apagado">
              {status === 'CONCLUIDA'
                ? '1 crédito foi consumido por este registro.'
                : status === 'FALHOU'
                  ? 'O crédito reservado voltou para o seu saldo.'
                  : '1 crédito reservado. Ele será consumido quando a selagem terminar; se algo falhar, volta para o seu saldo.'}
            </p>
          </Cartao>
          <Link to="/registros" className={`${classeBotao('contorno')} w-full`}>
            Ver meus registros
          </Link>
        </div>
      </div>
    </>
  );
}
