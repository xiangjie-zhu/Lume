/*
 * Renders the Lume app icon (green gradient square + white dot) to PNG via
 * Electron's offscreen capture, then packages an .icns bundle via iconutil.
 * Run: node scripts/build-icon.cjs  (actually: electron scripts/build-icon.cjs)
 */
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const SIZES = [16, 32, 64, 128, 256, 512, 1024];

const html = `
<!doctype html>
<html><head><style>
  html, body { margin: 0; padding: 0; background: transparent; }
  body { width: 1024px; height: 1024px; display: flex; align-items: center; justify-content: center; }
  .icon {
    width: 820px; height: 820px;
    border-radius: 200px;
    background: #ffffff;
    border: 1px solid rgba(0,0,0,0.05);
    box-shadow: 0 40px 80px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.06);
    display: flex; align-items: center; justify-content: center;
  }
  .dot { width: 360px; height: 360px; border-radius: 50%; background: #9fb09a; }
</style></head>
<body><div class="icon"><div class="dot"></div></div></body></html>
`;

app.whenReady().then(async () => {
  const buildDir = path.join(__dirname, '..', 'build');
  const iconsetDir = path.join(buildDir, 'icon.iconset');
  fs.mkdirSync(iconsetDir, { recursive: true });

  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: false },
  });

  await win.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'));
  // Give the page a moment to render
  await new Promise((r) => setTimeout(r, 200));

  const image = await win.webContents.capturePage();
  const png1024 = image.toPNG();
  fs.writeFileSync(path.join(buildDir, 'icon.png'), png1024);

  for (const size of SIZES) {
    const resized = image.resize({ width: size, height: size, quality: 'best' });
    const outPath = path.join(iconsetDir, `icon_${size}x${size}.png`);
    fs.writeFileSync(outPath, resized.toPNG());
    if (size <= 512) {
      const retinaPath = path.join(iconsetDir, `icon_${size}x${size}@2x.png`);
      const retina = image.resize({ width: size * 2, height: size * 2, quality: 'best' });
      fs.writeFileSync(retinaPath, retina.toPNG());
    }
  }

  try {
    execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(buildDir, 'icon.icns')}"`, { stdio: 'inherit' });
    console.log('✓ Generated build/icon.icns and build/icon.png');
  } catch (e) {
    console.error('iconutil failed:', e.message);
    process.exitCode = 1;
  }

  app.quit();
});
