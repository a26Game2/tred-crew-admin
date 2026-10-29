import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const api = new URL(env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1');
  if (!['http:', 'https:'].includes(api.protocol) || api.search || api.hash || api.username || api.password) throw new Error('VITE_API_BASE_URL must be an HTTP(S) API URL without credentials, query, or fragment');
  const port = Number(env.VITE_HOST_PORT || 5173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('VITE_HOST_PORT must be a valid port between 1 and 65535');
  const apiPath = api.pathname.replace(/\/$/, '') || '/api/v1';
  const proxy = { '/api/v1': { target: api.origin, changeOrigin: true, rewrite: (path: string) => path.replace(/^\/api\/v1(?=\/|\?|$)/, apiPath) } };
  return { plugins: [react(), tailwindcss()], server: { port, strictPort: true, proxy }, preview: { port, strictPort: true, proxy } };
});
