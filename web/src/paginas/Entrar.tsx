import { FormEvent, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Botao, Campo, classeBotao, Erro } from '../componentes/base';
import { IconeCadeado, IconeEmail } from '../componentes/icones';
import { MolduraEntrada } from '../componentes/Moldura';
import { useSessao } from '../sessao';

/** REQ03 — Logar. */
export function Entrar() {
  const { entrar } = useSessao();
  const recemCadastrado = (useLocation().state as { cadastrado?: boolean } | null)?.cadastrado;
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setCarregando(true);
    setErro(null);
    try {
      await entrar(String(form.get('email')), String(form.get('senha')));
    } catch (falha) {
      setErro(falha);
      setCarregando(false);
    }
  }

  return (
    <MolduraEntrada>
      <h1 className="text-3xl font-bold">Entrar</h1>
      <p className="mt-2 text-[15px] text-apagado">Acesse sua conta para registrar e consultar conteúdos.</p>
      {recemCadastrado && <p className="mt-6 rounded-md bg-sucesso-claro px-3 py-2 text-sm text-sucesso">Conta criada. Entre com seu e-mail e senha.</p>}
      <form onSubmit={enviar} className="mt-8 space-y-5">
        <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" required icone={<IconeEmail />} />
        <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password" required icone={<IconeCadeado />} />
        <Erro erro={erro} />
        <Botao type="submit" carregando={carregando} className="w-full">
          Entrar
        </Botao>
      </form>
      <div className="mt-8 border-t border-borda pt-6 text-center">
        <p className="text-sm text-apagado">Ainda não tem conta?</p>
        <Link to="/cadastro" className={`${classeBotao('contorno')} mt-3 w-full`}>
          Criar conta
        </Link>
      </div>
    </MolduraEntrada>
  );
}
