// The PC app: the app's own files served from this folder on this PC only, shown in its own window (full screen,
// F11 switches it). Game controllers work through the window's Gamepad API.
const { app, BrowserWindow, Menu, globalShortcut } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(path.dirname(process.execPath), 'app');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain' };
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]); if (p === '/') p = '/index.html';
      const f = path.normalize(path.join(ROOT, p));
      if (!f.startsWith(ROOT)) { rsp.writeHead(403); rsp.end(); return; }
      fs.readFile(f, (err, data) => { if (err) { rsp.writeHead(404); rsp.end(); return; } rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); rsp.end(data); });
    });
    srv.listen(0, '127.0.0.1', () => res(srv.address().port));
  });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const port = await serve();
  const win = new BrowserWindow({ width: 1600, height: 900, backgroundColor: '#05030c', fullscreen: true, autoHideMenuBar: true, title: 'Airline Manager Pro Babylon', icon: path.join(path.dirname(process.execPath), 'app.ico'), webPreferences: { backgroundThrottling: false } });
  win.loadURL(`http://127.0.0.1:${port}/`);
  win.webContents.on('before-input-event', (e, input) => { if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); } });
  globalShortcut.register('Alt+F4', () => app.quit());
});
app.on('window-all-closed', () => app.quit());
