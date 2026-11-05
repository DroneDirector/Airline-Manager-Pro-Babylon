// Builds the app: src/ bundled into www/app.js (esbuild, with Babylon.js), the app's name and version put in, and
// the Capacitor config (Android) written from app.config.json.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'app.config.json'), 'utf8'));
const babylon = JSON.parse(readFileSync(join(root, 'node_modules/@babylonjs/core/package.json'), 'utf8')).version;
await build({
  entryPoints: [join(root, 'src/main.ts')], bundle: true, minify: true, sourcemap: false, format: 'iife', target: ['chrome100'],
  outfile: join(root, 'www/app.js'), legalComments: 'none',
  define: { __APP__: JSON.stringify({ name: cfg.appName, short: cfg.shortName, id: cfg.appId, version: cfg.version, updates: cfg.updates, babylon }) },
});
writeFileSync(join(root, 'capacitor.config.json'), JSON.stringify({ appId: cfg.appId, appName: cfg.appName, webDir: 'www', android: { backgroundColor: '#05030c' } }, null, 2) + '\n');
const html = readFileSync(join(root, 'www/index.template.html'), 'utf8').replace(/%APP_NAME%/g, cfg.appName).replace(/%APP_VERSION%/g, cfg.version);
writeFileSync(join(root, 'www/index.html'), html);
console.log(`Built ${cfg.appName} ${cfg.version} (Babylon.js ${babylon})`);
