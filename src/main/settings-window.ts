import { join } from 'node:path';
import { BrowserWindow, screen } from 'electron';

const WIDTH = 332;
const HEIGHT = 720;
/** Breathing room between the overlay's edge and the panel. */
const GAP = 12;

/**
 * The settings panel as its own window, docked beside the overlay rather than
 * drawn over it, so every change is visible on the lyrics as it is made. A
 * normal framed window on purpose: the title bar gives it a drag handle and a
 * close button for free, and closing it is how interactive mode ends.
 */
export function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    title: 'Lyric Veil settings',
    backgroundColor: '#0b0b0c',
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.setMenuBarVisibility(false);

  // Same renderer bundle as the overlay; the hash tells it which root to mount.
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) void win.loadURL(`${devUrl}#settings`);
  else void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'settings' });

  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) win.show();
  });
  return win;
}

/**
 * Dock the panel beside the overlay: to the right when there is room, to the
 * left when the overlay sits near the right screen edge, and always fully on
 * screen. Re-run whenever the overlay moves or resizes.
 */
export function dockSettingsWindow(settings: BrowserWindow, overlay: BrowserWindow): void {
  if (settings.isDestroyed() || overlay.isDestroyed()) return;

  const o = overlay.getBounds();
  const { workArea } = screen.getDisplayMatching(o);
  const { width: w, height: h } = settings.getBounds();

  let x = o.x + o.width + GAP;
  if (x + w > workArea.x + workArea.width) x = o.x - w - GAP;
  x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - w));

  const y = Math.max(workArea.y, Math.min(o.y, workArea.y + workArea.height - h));

  settings.setPosition(x, y);
}
