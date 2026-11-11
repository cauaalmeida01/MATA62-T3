import { FormEvent, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Botao, Campo, Erro } from '../componentes/base';
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
      <h1 className="mb-6 font-titulo text-3xl font-semibold">Entrar</h1>
      {recemCadastrado && <p className="mb-4 bg-selo-claro px-3 py-2 text-sm text-selo">Conta criada. Entre com seu e-mail e senha.</p>}
      <form onSubmit={enviar} className="space-y-4">
        <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" required />
        <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password" required />
        <Erro erro={erro} />
        <Botao type="submit" carregando={carregando}>
          Entrar
        </Botao>
      </form>
      <p className="mt-8 text-sm text-apagado">
        Ainda não tem conta?{' '}
        <Link to="/cadastro" className="text-tinta underline underline-offset-4">
          Criar conta
        </Link>
      </p>
    </MolduraEntrada>
  );
}
