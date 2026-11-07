// The PC app: the app's own files served from this folder on this PC only, shown in its own window (full screen,
// F11 switches it). Game controllers work through the window's Gamepad API.
const { app, BrowserWindow, Menu, globalShortcut } = require('electron');
// settings and saves stay in the same folder they have always been in (AppData), whatever the game is called
try { app.setPath('userData', require('node:path').join(app.getPath('appData'), 'Airline Manager Pro Babylon')); } catch (e) { /* the default folder */ }
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(path.dirname(process.execPath), 'app');
const os = require('node:os');
const { spawn } = require('node:child_process');
// Updates from inside the game: the new installer is downloaded, then the game closes, the installer runs quietly
// over it (keeping the settings) and the game opens again.
const UPD = { state: 'idle', pct: -1, error: '' };
async function startUpdate(url, version) {
  if (UPD.state === 'downloading' || UPD.state === 'installing') return;
  let host = ''; try { host = new URL(url).hostname; } catch (e) { /* not an address */ }
  if (!/(^|\.)github\.com$/.test(host)) { UPD.state = 'failed'; UPD.error = 'The update must come from the game\'s own releases.'; return; }
  UPD.state = 'downloading'; UPD.pct = 0; UPD.error = '';
  try {
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) throw new Error(`The download answered ${r.status} ${r.statusText}`);
    const total = Number(r.headers.get('content-length')) || 0, file = path.join(os.tmpdir(), `AirlineManagerProBabylon-Setup-${String(version).replace(/[^0-9.]/g, '')}.exe`);
    const out = fs.createWriteStream(file), rd = r.body.getReader(); let got = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; got += value.length; out.write(Buffer.from(value)); if (total) UPD.pct = Math.floor(got * 100 / total); }
    await new Promise((res, rej) => { out.on('error', rej); out.end(res); });
    if (total && got !== total) throw new Error(`The download was incomplete (${got} of ${total} bytes)`);
    UPD.state = 'installing'; UPD.pct = 100;
    const cmd = path.join(os.tmpdir(), 'ampb-update.cmd');
    fs.writeFileSync(cmd, ['@echo off', 'timeout /t 2 /nobreak >nul', `"${file}" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /CLOSEAPPLICATIONS`, `start "" "${process.execPath}"`, ''].join('\r\n'));
    spawn('cmd.exe', ['/c', cmd], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    setTimeout(() => app.quit(), 900);
  } catch (e) { UPD.state = 'failed'; UPD.error = 'The update couldn\'t be installed: ' + ((e && e.message) || e); }
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.wasm': 'application/wasm', '.ktx2': 'image/ktx2', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.md': 'text/markdown; charset=utf-8', '.onnx': 'application/octet-stream' };
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      if ((req.url || '').split('?')[0] === '/api/log' && req.method === 'POST') {   // a problem for Documents\\Airport Dynasty Pro\\Logs\\problems.log
        let b = ''; req.on('data', c => { b += c; if (b.length > 1e5) req.destroy(); });
        req.on('end', () => { try { const j = JSON.parse(b || '{}'), dir = path.join(app.getPath('documents'), 'Airport Dynasty Pro', 'Logs'); fs.mkdirSync(dir, { recursive: true });
          const line = `${new Date(j.at || Date.now()).toISOString()}  ${j.place || ''}: ${j.what || ''}\r\n    ${j.why || ''}${j.detail ? '\r\n    ' + String(j.detail).replace(/\n/g, '\r\n    ') : ''}\r\n\r\n`;
          fs.appendFileSync(path.join(dir, 'problems.log'), line); } catch (e) { /* not written */ } rsp.writeHead(204); rsp.end(); }); return; }
      if ((req.url || '').split('?')[0] === '/api/update') {
        if (req.method === 'POST') { let b = ''; req.on('data', c => { b += c; if (b.length > 1e5) req.destroy(); }); req.on('end', () => { let j = {}; try { j = JSON.parse(b || '{}'); } catch (e) { /* empty */ } startUpdate(j.url, j.version); rsp.writeHead(200, { 'Content-Type': 'application/json' }); rsp.end(JSON.stringify(UPD)); }); return; }
        rsp.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); rsp.end(JSON.stringify(UPD)); return;
      }
      let p = decodeURIComponent((req.url || '/').split('?')[0]); if (p === '/') p = '/index.html';
      const f = path.normalize(path.join(ROOT, p));
      if (!f.startsWith(ROOT)) { rsp.writeHead(403); rsp.end(); return; }
      fs.readFile(f, (err, data) => { if (err) { rsp.writeHead(404); rsp.end(); return; } rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); rsp.end(data); });
    });
    // a fixed port, so the settings (kept by the page) are the same every time; another one if it is taken
    srv.once('error', () => srv.listen(0, '127.0.0.1', () => res(srv.address().port)));
    srv.listen(47631, '127.0.0.1', () => res(srv.address().port));
  });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const port = await serve();
  const win = new BrowserWindow({ width: 1600, height: 900, backgroundColor: '#05030c', fullscreen: true, autoHideMenuBar: true, title: 'Airport Dynasty Pro', icon: path.join(path.dirname(process.execPath), 'app.ico'), webPreferences: { backgroundThrottling: false } });
  // photos taken in the game go straight into Pictures\Airport Dynasty Pro, without asking
  win.webContents.session.on('will-download', (e, item) => { const n = item.getFilename(); if (!/^AMP-photo/.test(n)) return; const dir = path.join(app.getPath('pictures'), 'Airport Dynasty Pro'); try { fs.mkdirSync(dir, { recursive: true }); } catch (er) { /* there */ } item.setSavePath(path.join(dir, n)); });
  win.loadURL(`http://127.0.0.1:${port}/`);
  win.webContents.on('before-input-event', (e, input) => { if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); } });
  globalShortcut.register('Alt+F4', () => app.quit());
});
// Exit in the game closes the window: the program quits completely
app.on('window-all-closed', () => app.quit());
