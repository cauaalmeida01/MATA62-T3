import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TipoUsuario } from '../api/tipos';
import { Botao, Campo, Erro } from '../componentes/base';
import { IconeCadeado, IconeEmail } from '../componentes/icones';
import { MolduraEntrada } from '../componentes/Moldura';
import { useSessao } from '../sessao';

const TIPOS: { valor: TipoUsuario; texto: string }[] = [
  { valor: 'ADVOGADO', texto: 'Advogado' },
  { valor: 'COMUM', texto: 'Usuário comum' },
];

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
      });
      navegar('/entrar', { state: { cadastrado: true } });
    } catch (falha) {
      setErro(falha);
      setCarregando(false);
    }
  }

  return (
    <MolduraEntrada>
      <h1 className="text-3xl font-bold">Criar conta</h1>
      <p className="mt-2 text-[15px] text-apagado">Os dados são usados para identificar o responsável por cada registro.</p>
      <form onSubmit={enviar} className="mt-8 space-y-5">
        <fieldset>
          <legend className="text-sm font-medium">
            Tipo de conta<span aria-hidden> *</span>
          </legend>
          <div className="mt-1.5 grid grid-cols-2 gap-3">
            {TIPOS.map((opcao) => {
              const ativo = tipo === opcao.valor;
              return (
                <label
                  key={opcao.valor}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3.5 py-3 text-sm font-medium ${
                    ativo ? 'border-laranja bg-laranja-claro' : 'border-borda bg-white'
                  }`}
                >
                  <input type="radio" name="tipo" checked={ativo} onChange={() => setTipo(opcao.valor)} className="accent-laranja" />
                  {opcao.texto}
                </label>
              );
            })}
          </div>
        </fieldset>
        <Campo rotulo="Nome completo" name="nome" autoComplete="name" required />
        <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" required icone={<IconeEmail />} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo rotulo="CPF" name="cpf" inputMode="numeric" placeholder="000.000.000-00" required />
          {tipo === 'ADVOGADO' && <Campo rotulo="Número da OAB" name="oab" placeholder="BA 12.345" required ajuda="Exibido apenas para advogados" />}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo rotulo="Senha" name="senha" type="password" autoComplete="new-password" minLength={10} required icone={<IconeCadeado />} ajuda="Mínimo de 10 caracteres" />
          <Campo rotulo="Confirmar senha" name="confirmacao" type="password" autoComplete="new-password" required icone={<IconeCadeado />} />
        </div>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" required className="mt-0.5 accent-marinho" />
          Li e aceito os Termos de Uso e a Política de Privacidade (LGPD).
        </label>
        <Erro erro={erro} />
        <Botao type="submit" carregando={carregando} className="w-full">
          Criar conta
        </Botao>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link to="/entrar" className="font-semibold text-laranja hover:underline">
          Já tem conta? Entrar
        </Link>
      </p>
    </MolduraEntrada>
  );
}
