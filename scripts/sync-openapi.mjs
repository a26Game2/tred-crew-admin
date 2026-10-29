import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = process.env.TRED_API_DIR || resolve(root, '../tred-crew-api');
const output = resolve(root, 'src/openapi.json');
const code = `import { swaggerSpec } from './src/config/swagger.ts'; import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(output)}, JSON.stringify(swaggerSpec, null, 2));`;
const result = spawnSync(process.execPath, [resolve(backend, 'node_modules/tsx/dist/cli.mjs'), '-e', code], { cwd: backend, stdio: 'inherit' });
if (result.error) { console.error(result.error.message); process.exit(1); }
process.exit(result.status ?? 1);
