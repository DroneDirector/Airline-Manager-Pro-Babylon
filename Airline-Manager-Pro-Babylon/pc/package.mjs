// Packages the PC app for Windows: Electron's own files (MIT, with Chromium) renamed to the app's program with its
// icon, the window's code (main.js) and the app's files (www) in app/. Then zipped by the workflow.
import { execSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), top = join(here, '..');
const cfg = JSON.parse(readFileSync(join(top, 'app.config.json'), 'utf8'));
const out = join(here, 'build'), pkg = join(out, 'Airport Dynasty Pro PC');
rmSync(out, { recursive: true, force: true }); mkdirSync(pkg, { recursive: true });
const engine = join(here, 'node_modules', 'electron', 'dist');
if (!existsSync(join(engine, 'version'))) execSync('node node_modules/electron/install.js', { stdio: 'inherit', cwd: here });
cpSync(engine, pkg, { recursive: true });
rmSync(join(pkg, 'resources', 'default_app.asar'), { force: true });
const exe = join(pkg, 'AirlineManagerProBabylon.exe');
if (existsSync(join(pkg, 'electron.exe'))) { copyFileSync(join(pkg, 'electron.exe'), exe); rmSync(join(pkg, 'electron.exe')); }
if (existsSync(join(pkg, 'LICENSE'))) { copyFileSync(join(pkg, 'LICENSE'), join(pkg, 'LICENSE.electron.txt')); rmSync(join(pkg, 'LICENSE')); }
const rc = [join(here, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe'), join(here, 'node_modules', 'rcedit', 'bin', 'rcedit.exe')].filter(existsSync)[0];
if (rc && process.platform === 'win32') {
  const v4 = cfg.version + '.0';
  try { execFileSync(rc, [exe, '--set-icon', join(here, 'app.ico'), '--set-file-version', v4, '--set-product-version', v4, '--set-version-string', 'ProductName', cfg.appName, '--set-version-string', 'FileDescription', cfg.appName, '--set-version-string', 'CompanyName', cfg.publisher, '--set-version-string', 'LegalCopyright', '© ' + new Date().getFullYear() + ' ' + cfg.publisher], { stdio: 'inherit' }); } catch (e) { console.log('Icon not set:', e.message); }
}
const res = join(pkg, 'resources', 'app'); mkdirSync(res, { recursive: true });
copyFileSync(join(here, 'main.js'), join(res, 'main.js'));
writeFileSync(join(res, 'package.json'), JSON.stringify({ name: 'airline-manager-pro-babylon', productName: cfg.appName, version: cfg.version, main: 'main.js', private: true }, null, 2));
copyFileSync(join(here, 'app.ico'), join(pkg, 'app.ico'));
const web = join(top, 'www');
if (!existsSync(join(web, 'app.js'))) throw new Error('Build the app first (npm run build)');
cpSync(web, join(pkg, 'app'), { recursive: true, filter: s => !/index\.template\.html$/.test(s) });
writeFileSync(join(pkg, 'README.txt'), [`${cfg.appName} ${cfg.version}`, '', 'Double-click AirlineManagerProBabylon.exe. F11 switches full screen; Alt+F4 quits.', 'A PlayStation controller (or any game controller) works by cable or Bluetooth.', ''].join('\r\n'));
console.log('Packaged ' + pkg);
