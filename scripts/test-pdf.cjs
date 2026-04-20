/*
 * Headless smoke test for Lume:
 * 1. Launches the built Electron app with the custom app:// protocol
 * 2. Generates a small test PDF via pdf-lib
 * 3. Injects it into the Reader tool's <input type="file">
 * 4. Waits until either a PDF page canvas appears (success) or the
 *    "Failed to load PDF file" error shows (failure)
 *
 * Exits 0 on success, 1 on failure.
 */
const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true },
  },
]);

async function makeTestPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Lume Test PDF', { x: 60, y: 340, size: 24, font, color: rgb(0.15, 0.2, 0.15) });
  page.drawText('If you can see this, PDF loading works.', { x: 60, y: 300, size: 12, font });
  page.drawRectangle({ x: 60, y: 80, width: 280, height: 200, borderColor: rgb(0.3, 0.5, 0.3), borderWidth: 2 });
  return Buffer.from(await doc.save());
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(win, fn, timeoutMs = 15000, intervalMs = 250) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await win.webContents.executeJavaScript(`(${fn.toString()})()`, true);
    if (result) return result;
    await delay(intervalMs);
  }
  return null;
}

app.whenReady().then(async () => {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    if (!pathname || pathname === '/') pathname = '/index.html';
    const distDir = path.join(__dirname, '..', 'dist');
    const resolved = path.join(distDir, pathname);
    if (!resolved.startsWith(distDir)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(resolved).toString());
  });

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  const consoleMessages = [];
  win.webContents.on('console-message', (_e, level, message, line, source) => {
    consoleMessages.push({ level, message, source: `${source}:${line}` });
    if (message.includes('Lume') || message.includes('pdf') || message.includes('PDF') || message.includes('worker') || level >= 2) {
      console.log(`[renderer L${level}] ${message}`);
    }
  });

  win.webContents.on('render-process-gone', (_e, d) => {
    console.error('Renderer gone:', d);
    process.exit(1);
  });

  await win.loadURL('app://bundle/index.html');
  console.log('Loaded app://bundle/index.html');

  // Wait for Home Dashboard to render
  const homeReady = await waitFor(win, () => !!document.querySelector('button, input[type="file"], [class*="Home"]'), 10000);
  if (!homeReady) {
    console.error('FAIL: app did not render within 10s');
    console.error('console messages:', consoleMessages.slice(-20));
    process.exit(1);
  }
  console.log('App UI rendered.');

  // Navigate to Reader by clicking the Reader sidebar button
  await win.webContents.executeJavaScript(`
    (() => {
      const btns = [...document.querySelectorAll('button')];
      const target = btns.find(b => b.textContent && b.textContent.trim() === 'Reader');
      if (target) { target.click(); return true; }
      return false;
    })()
  `);
  console.log('Clicked Reader tab.');
  await delay(500);

  // Build a File object from the test PDF and dispatch change on the hidden input
  const pdfBuffer = await makeTestPdf();
  const pdfBase64 = pdfBuffer.toString('base64');
  console.log(`Test PDF ready (${pdfBuffer.length} bytes).`);

  const injectResult = await win.webContents.executeJavaScript(`
    (async () => {
      const input = document.querySelector('input[type="file"][accept*="pdf"], input[type="file"]');
      if (!input) return { ok: false, reason: 'no file input' };
      const bin = atob("${pdfBase64}");
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], 'test.pdf', { type: 'application/pdf' });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true };
    })()
  `);
  console.log('Injected PDF:', injectResult);
  if (!injectResult?.ok) {
    console.error('FAIL: could not inject PDF');
    process.exit(1);
  }

  // Wait for success (canvas rendered) OR failure ("Failed to load PDF file")
  const outcome = await waitFor(
    win,
    () => {
      const body = document.body.innerText;
      if (body.includes('Failed to load PDF file')) return { status: 'fail', text: body.slice(0, 200) };
      const canvas = document.querySelector('canvas.react-pdf__Page__canvas, .react-pdf__Page canvas');
      if (canvas) return { status: 'ok', size: `${canvas.width}x${canvas.height}` };
      return null;
    },
    20000,
    300,
  );

  if (!outcome) {
    console.error('FAIL: timed out waiting for PDF render');
    console.error('recent console:', consoleMessages.slice(-20));
    process.exit(1);
  }

  if (outcome.status === 'fail') {
    const pdfError = await win.webContents.executeJavaScript(`window.__lumePdfError || null`);
    console.error('FAIL: react-pdf reported "Failed to load PDF file"');
    console.error('actual pdf error:', pdfError);
    console.error('recent console (all):');
    for (const m of consoleMessages) console.error(`  [L${m.level}] ${m.message.slice(0, 200)}`);
    process.exit(1);
  }

  console.log(`✓ PDF rendered successfully (canvas ${outcome.size})`);

  // Verify history was recorded and Home Dashboard reflects it
  await delay(500);
  await win.webContents.executeJavaScript(`
    (() => {
      const btns = [...document.querySelectorAll('button')];
      const home = btns.find(b => b.textContent && b.textContent.trim() === 'Home Dashboard');
      if (home) home.click();
      // Also switch via tab click
      const tabs = [...document.querySelectorAll('div')];
      const homeTab = tabs.find(d => d.textContent && d.textContent.trim() === 'Home Dashboard' && d.className.includes('rounded-t-xl'));
      if (homeTab) homeTab.click();
    })()
  `);
  await delay(500);

  const historyCheck = await waitFor(
    win,
    () => {
      const body = document.body.innerText || '';
      if (body.includes('test.pdf')) return { status: 'ok', visible: true };
      if (body.includes('No recent documents')) return { status: 'empty' };
      return null;
    },
    5000,
    300,
  );

  if (!historyCheck || historyCheck.status !== 'ok') {
    console.error('FAIL: history did not show test.pdf on Home Dashboard');
    console.error('historyCheck:', historyCheck);
    const dump = await win.webContents.executeJavaScript(`document.body.innerText.slice(0, 500)`);
    console.error('body dump:', dump);
    process.exit(1);
  }
  console.log('✓ History recorded and visible on Home Dashboard');

  process.exit(0);
});
