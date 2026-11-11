import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Moldura } from './componentes/Moldura';
import { Cadastro } from './paginas/Cadastro';
import { DetalheRegistro } from './paginas/DetalheRegistro';
import { Entrar } from './paginas/Entrar';
import { NovoRegistro } from './paginas/NovoRegistro';
import { Registros } from './paginas/Registros';
import { ProvedorSessao, useSessao } from './sessao';
import './estilo.css';

function Rotas() {
  const { token } = useSessao();

  if (!token) {
    return (
      <Routes>
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="*" element={<Navigate to="/entrar" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Moldura />}>
        <Route path="/registros" element={<Registros />} />
        <Route path="/registros/novo" element={<NovoRegistro />} />
        <Route path="/registros/:id" element={<DetalheRegistro />} />
      </Route>
      <Route path="*" element={<Navigate to="/registros" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <ProvedorSessao>
      <BrowserRouter>
        <Rotas />
      </BrowserRouter>
    </ProvedorSessao>
  </StrictMode>,
);
