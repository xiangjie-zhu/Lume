const { app, BrowserWindow, shell, Menu, protocol, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const isDev = process.env.NODE_ENV === 'development';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      codeCache: true,
    },
  },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: '#f5f3ee',
    title: 'Lume',
    show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadURL('app://bundle/index.html');
  }

  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('Renderer crashed:', details);
  });
}

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

app.whenReady().then(() => {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    if (!pathname || pathname === '/') pathname = '/index.html';

    const distDir = path.join(__dirname, '..', 'dist');
    const resolved = path.join(distDir, pathname);

    if (!resolved.startsWith(distDir)) {
      return new Response('forbidden', { status: 403 });
    }

    const response = await net.fetch(pathToFileURL(resolved).toString());
    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME[ext];
    if (contentType) {
      const headers = new Headers(response.headers);
      headers.set('Content-Type', contentType);
      return new Response(response.body, { status: response.status, headers });
    }
    return response;
  });

  if (process.platform === 'darwin') {
    const template = [
      { role: 'appMenu' },
      { role: 'fileMenu' },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
