import { AcessoNegado, Conflito, ITokensRevogados, RegraDeNegocioViolada, verificarJwt } from '@app/compartilhado';
import { CadastrarUsuarioUseCase, LogarUseCase, SairUseCase } from './aplicacao';
import { Cpf, ICreditosClient, IUsuarioRepository, Usuario } from './dominio';
import { AesProtetorCpf, JwtEmissorToken, ScryptHasherSenha } from './infra';

class UsuariosEmMemoria implements IUsuarioRepository {
  lista: Usuario[] = [];
  existeEmail = async (email: string) => this.lista.some((u) => u.email === email);
  existeCpfHash = async (h: string) => this.lista.some((u) => u.cpfHash === h);
  criar = async (u: Usuario) => void this.lista.push(u);
  buscarPorEmail = async (email: string) => this.lista.find((u) => u.email === email) ?? null;
}

class CreditosFalso implements ICreditosClient {
  carteiras: string[] = [];
  foraDoAr = false;
  async criarCarteira(userId: string) {
    if (this.foraDoAr) throw new Error('creditos-api fora do ar');
    if (!this.carteiras.includes(userId)) this.carteiras.push(userId);
  }
}

class RevogadosEmMemoria implements ITokensRevogados {
  jtis = new Set<string>();
  revogar = async (jti: string) => void this.jtis.add(jti);
  estaRevogado = async (jti: string) => this.jtis.has(jti);
}

const SEGREDO = 'segredo-de-teste';
const CPF_VALIDO = '529.982.247-25';

function montar() {
  const usuarios = new UsuariosEmMemoria();
  const creditos = new CreditosFalso();
  const revogados = new RevogadosEmMemoria();
  const hasher = new ScryptHasherSenha();
  return {
    usuarios,
    creditos,
    revogados,
    cadastrar: new CadastrarUsuarioUseCase(usuarios, hasher, new AesProtetorCpf('chave'), creditos),
    logar: new LogarUseCase(usuarios, hasher, new JwtEmissorToken(SEGREDO, 3600), creditos),
    sair: new SairUseCase(revogados),
  };
}

const advogado = { nome: 'Ana', email: 'Ana@Exemplo.com ', senha: 'senha-forte', tipo: 'ADVOGADO' as const, cpf: CPF_VALIDO, oab: 'ba12345' };

describe('Cpf (objeto de valor)', () => {
  it('aceita CPF válido com ou sem pontuação', () => {
    expect(Cpf.criar('529.982.247-25').digitos).toBe('52998224725');
    expect(Cpf.criar('11144477735').digitos).toBe('11144477735');
  });

  it.each(['12345678900', '111.111.111-11', '123', ''])('recusa %p', (cpf) => {
    expect(() => Cpf.criar(cpf)).toThrow(RegraDeNegocioViolada);
  });
});

describe('Proteção de senha e CPF', () => {
  it('o hash da senha não contém a senha e confere só a senha certa', async () => {
    const hasher = new ScryptHasherSenha();
    const hash = await hasher.gerarHash('minha-senha');
    expect(hash).not.toContain('minha-senha');
    expect(await hasher.gerarHash('minha-senha')).not.toBe(hash); // sal diferente
    expect(await hasher.conferir('minha-senha', hash)).toBe(true);
    expect(await hasher.conferir('outra-senha', hash)).toBe(false);
  });

  it('o CPF cifrado não mostra os dígitos e o hash de busca é sempre o mesmo', () => {
    const protetor = new AesProtetorCpf('chave');
    const cpf = Cpf.criar(CPF_VALIDO);
    expect(protetor.cifrar(cpf)).not.toContain('52998224725');
    expect(protetor.cifrar(cpf)).not.toBe(protetor.cifrar(cpf));
    expect(protetor.hashParaBusca(cpf)).toBe(protetor.hashParaBusca(cpf));
    expect(new AesProtetorCpf('outra-chave').hashParaBusca(cpf)).not.toBe(protetor.hashParaBusca(cpf));
  });
});

describe('REQ01 Cadastrar usuário', () => {
  it('cadastra advogado, normaliza e-mail e OAB e cria a carteira', async () => {
    const { cadastrar, usuarios, creditos } = montar();
    const saida = await cadastrar.executar(advogado);
    expect(saida).toEqual({ id: expect.any(String), nome: 'Ana', email: 'ana@exemplo.com', tipo: 'ADVOGADO' });
    expect(usuarios.lista[0].oab).toBe('BA12345');
    expect(usuarios.lista[0].senhaHash).not.toContain('senha-forte');
    expect(creditos.carteiras).toEqual([saida.id]);
  });

  it('cadastra usuário comum sem OAB', async () => {
    const { cadastrar } = montar();
    await expect(cadastrar.executar({ ...advogado, tipo: 'COMUM', oab: undefined })).resolves.toMatchObject({ tipo: 'COMUM' });
  });

  it('exige OAB do advogado', async () => {
    const { cadastrar } = montar();
    await expect(cadastrar.executar({ ...advogado, oab: undefined })).rejects.toThrow(RegraDeNegocioViolada);
  });

  it('recusa e-mail ou CPF repetidos', async () => {
    const { cadastrar } = montar();
    await cadastrar.executar(advogado);
    await expect(cadastrar.executar({ ...advogado, email: 'ANA@exemplo.com' })).rejects.toThrow(Conflito);
    await expect(cadastrar.executar({ ...advogado, email: 'outra@exemplo.com', cpf: '52998224725' })).rejects.toThrow(Conflito);
  });

  it('recusa senha curta', async () => {
    const { cadastrar } = montar();
    await expect(cadastrar.executar({ ...advogado, senha: '1234567' })).rejects.toThrow(RegraDeNegocioViolada);
  });

  it('o cadastro vale mesmo com a creditos-api fora do ar', async () => {
    const { cadastrar, usuarios, creditos } = montar();
    creditos.foraDoAr = true;
    await cadastrar.executar(advogado);
    expect(usuarios.lista).toHaveLength(1);
  });
});

describe('REQ03 Logar e REQ04 Sair', () => {
  it('login devolve um JWT com sub, jti, tipo e exp', async () => {
    const { cadastrar, logar } = montar();
    const { id } = await cadastrar.executar(advogado);
    const sessao = await logar.executar({ email: 'ana@exemplo.com', senha: 'senha-forte' });
    const payload = verificarJwt(sessao.token, SEGREDO);
    expect(payload).toMatchObject({ sub: id, tipo: 'ADVOGADO', jti: expect.any(String) });
    expect(new Date(sessao.expiraEm).getTime()).toBe(payload.exp * 1000);
  });

  it('senha errada e e-mail inexistente dão o mesmo erro', async () => {
    const { cadastrar, logar } = montar();
    await cadastrar.executar(advogado);
    await expect(logar.executar({ email: 'ana@exemplo.com', senha: 'errada!!' })).rejects.toThrow('E-mail ou senha inválidos');
    await expect(logar.executar({ email: 'ninguem@exemplo.com', senha: 'senha-forte' })).rejects.toThrow('E-mail ou senha inválidos');
  });

  it('login cria a carteira que o cadastro não conseguiu criar', async () => {
    const { cadastrar, logar, creditos } = montar();
    creditos.foraDoAr = true;
    const { id } = await cadastrar.executar(advogado);
    creditos.foraDoAr = false;
    await logar.executar({ email: 'ana@exemplo.com', senha: 'senha-forte' });
    expect(creditos.carteiras).toEqual([id]);
  });

  it('logout revoga o jti do token', async () => {
    const { cadastrar, logar, sair, revogados } = montar();
    await cadastrar.executar(advogado);
    const { token } = await logar.executar({ email: 'ana@exemplo.com', senha: 'senha-forte' });
    const { jti, exp } = verificarJwt(token, SEGREDO);
    await sair.executar({ jti, expiraEm: new Date(exp * 1000) });
    expect(await revogados.estaRevogado(jti)).toBe(true);
  });

  it('token assinado com outro segredo é recusado', async () => {
    const { cadastrar } = montar();
    const { id } = await cadastrar.executar(advogado);
    const { token } = new JwtEmissorToken('segredo-falso', 3600).emitir({ id, tipo: 'COMUM' });
    expect(() => verificarJwt(token, SEGREDO)).toThrow(AcessoNegado);
  });
});
