import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = loadEnv('development', root, '');
const port = Number(env.VITE_HOST_PORT || 5173);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('VITE_HOST_PORT must be a valid port between 1 and 65535.');
  process.exit(1);
}
if (process.platform !== 'win32') {
  console.warn('Automatic cleanup is available on Windows; free the configured port manually if it is in use.');
  process.exit(0);
}
const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', resolve(root, 'scripts/stop-previous-vite.ps1'), '-Port', String(port), '-ProjectRoot', root], { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
