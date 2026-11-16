import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Em desenvolvimento, /api vai para o Nginx (docker compose up), como em produção.
// "npm run dev:mock" usa a API falsa em memória e não precisa do back.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8080' } },
});
