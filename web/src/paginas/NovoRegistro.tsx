import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErroApi, StatusSolicitacao } from '../api/tipos';
import { Botao, Campo, Erro, Pagina } from '../componentes/base';
import { useSessao } from '../sessao';

const ETAPAS: { status: StatusSolicitacao; texto: string }[] = [
  { status: 'PENDENTE', texto: 'Pedido recebido, aguardando na fila' },
  { status: 'PROCESSANDO', texto: 'Abrindo a página e capturando a tela' },
  { status: 'CONCLUIDA', texto: 'Evidências seladas e registro concluído' },
];

/** REQ08 — Iniciar registro (captura de tela), e acompanha até a conclusão (REQ11). */
export function NovoRegistro() {
  const { api, token } = useSessao();
  const navegar = useNavigate();
  const [solicitacaoId, setSolicitacaoId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusSolicitacao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setCarregando(true);
    setErro(null);
    try {
      const s = await api.solicitarRegistro(token!, String(f.get('url')).trim(), String(f.get('titulo')).trim());
      setSolicitacaoId(s.solicitacaoId);
      setStatus(s.status);
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

  // Acompanha a solicitação a cada 2 s até concluir ou falhar.
  useEffect(() => {
    if (!solicitacaoId || status === 'CONCLUIDA' || status === 'FALHOU') return;
    const timer = setInterval(async () => {
      try {
        const s = await api.statusSolicitacao(token!, solicitacaoId);
        setStatus(s.status);
      } catch {
        /* falha de rede momentânea: tenta de novo no próximo ciclo */
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [api, token, solicitacaoId, status]);

  // O registro concluído tem o mesmo id da solicitação? Não necessariamente: volta para a lista.
  useEffect(() => {
    if (status === 'CONCLUIDA') {
      const t = setTimeout(() => navegar('/registros'), 1500);
      return () => clearTimeout(t);
    }
  }, [status, navegar]);

  if (solicitacaoId && status) {
    const atual = ETAPAS.findIndex((e) => e.status === status);
    return (
      <Pagina titulo="Registrando a página">
        {status === 'FALHOU' ? (
          <div className="space-y-4">
            <p role="alert" className="border-l-2 border-erro bg-erro/5 px-3 py-2 text-erro">
              Não foi possível capturar a página depois de três tentativas. O crédito reservado foi devolvido.
            </p>
            <Link to="/registros" className="underline underline-offset-4">
              Voltar aos registros
            </Link>
          </div>
        ) : (
          <ol className="space-y-3" aria-live="polite">
            {ETAPAS.map((etapa, i) => (
              <li key={etapa.status} className={`flex items-center gap-3 ${i > atual ? 'text-apagado/60' : ''}`}>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                    i < atual || status === 'CONCLUIDA' ? 'border-selo bg-selo text-white' : i === atual ? 'border-tinta' : 'border-linha'
                  }`}
                >
                  {i + 1}
                </span>
                {etapa.texto}
              </li>
            ))}
          </ol>
        )}
      </Pagina>
    );
  }

  return (
    <Pagina titulo="Registrar uma página">
      <form onSubmit={enviar} className="max-w-xl space-y-4">
        <Campo rotulo="Endereço da página" name="url" type="url" placeholder="https://" required />
        <Campo rotulo="Título do registro" name="titulo" placeholder="Ex.: Post com ofensas no perfil da empresa" required ajuda="Para você reconhecer o registro depois." />
        <p className="text-sm text-apagado">Cada registro usa 1 crédito. Se a captura falhar, o crédito volta para você.</p>
        <Erro erro={erro} />
        <div className="flex items-center gap-5">
          <Botao type="submit" carregando={carregando}>
            Registrar
          </Botao>
          <Link to="/registros" className="text-sm underline-offset-4 hover:underline">
            Cancelar
          </Link>
        </div>
      </form>
    </Pagina>
  );
}
