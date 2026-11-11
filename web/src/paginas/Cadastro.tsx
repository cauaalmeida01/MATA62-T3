import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TipoUsuario } from '../api/tipos';
import { Botao, Campo, Erro } from '../componentes/base';
import { MolduraEntrada } from '../componentes/Moldura';
import { useSessao } from '../sessao';

/** REQ01 — Cadastrar usuário (advogado com OAB obrigatória, ou usuário comum). */
export function Cadastro() {
  const { api } = useSessao();
  const navegar = useNavigate();
  const [tipo, setTipo] = useState<TipoUsuario>('ADVOGADO');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const texto = (nome: string) => String(f.get(nome) ?? '').trim();

    if (texto('senha') !== texto('confirmacao')) {
      setErro(new Error('As senhas não conferem.'));
      return;
    }

    setCarregando(true);
    setErro(null);
    try {
      await api.cadastrar({
        nome: texto('nome'),
        email: texto('email'),
        senha: texto('senha'),
        cpf: texto('cpf').replace(/\D/g, ''),
        tipo,
        oab: tipo === 'ADVOGADO' ? texto('oab') : undefined,
        telefone: texto('telefone') || undefined,
      });
      navegar('/entrar', { state: { cadastrado: true } });
    } catch (falha) {
      setErro(falha);
      setCarregando(false);
    }
  }

  return (
    <MolduraEntrada>
      <h1 className="mb-6 font-titulo text-3xl font-semibold">Criar conta</h1>
      <form onSubmit={enviar} className="space-y-4">
        <fieldset>
          <legend className="text-sm font-medium">Você é</legend>
          <div className="mt-2 flex gap-6">
            {(['ADVOGADO', 'COMUM'] as const).map((opcao) => (
              <label key={opcao} className="flex items-center gap-2">
                <input type="radio" name="tipo" checked={tipo === opcao} onChange={() => setTipo(opcao)} className="accent-tinta" />
                {opcao === 'ADVOGADO' ? 'Advogado' : 'Pessoa física'}
              </label>
            ))}
          </div>
        </fieldset>
        <Campo rotulo="Nome completo" name="nome" autoComplete="name" required />
        <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" required />
        <Campo rotulo="CPF" name="cpf" inputMode="numeric" placeholder="000.000.000-00" required />
        {tipo === 'ADVOGADO' && <Campo rotulo="Número da OAB" name="oab" placeholder="BA 12345" required />}
        <Campo rotulo="Telefone (opcional)" name="telefone" type="tel" autoComplete="tel" />
        <Campo rotulo="Senha" name="senha" type="password" autoComplete="new-password" minLength={8} required ajuda="Pelo menos 8 caracteres." />
        <Campo rotulo="Confirme a senha" name="confirmacao" type="password" autoComplete="new-password" required />
        <Erro erro={erro} />
        <Botao type="submit" carregando={carregando}>
          Criar conta
        </Botao>
      </form>
      <p className="mt-8 text-sm text-apagado">
        Já tem conta?{' '}
        <Link to="/entrar" className="text-tinta underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </MolduraEntrada>
  );
}
