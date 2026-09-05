import { join } from 'node:path';
import { type AppConfig, clampPercent } from '@shared/config';
import { BrowserWindow, screen, shell } from 'electron';
import { createLogger } from './lib/logger';

const log = createLogger('window');

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Position is stored as a percentage of the free space on the primary display
 * rather than in pixels, so a slider in the settings panel maps to it directly
 * and a changed resolution keeps the overlay roughly where it was.
 */
export function boundsFromConfig(config: AppConfig): Bounds {
  const { workArea } = screen.getPrimaryDisplay();
  const width = Math.min(config.width, workArea.width);
  const height = Math.min(config.height, workArea.height);
  return {
    x: workArea.x + Math.round(((workArea.width - width) * config.posX) / 100),
    y: workArea.y + Math.round(((workArea.height - height) * config.posY) / 100),
    width,
    height,
  };
}

export function percentFromBounds(bounds: Bounds): Pick<AppConfig, 'posX' | 'posY'> {
  const { workArea } = screen.getPrimaryDisplay();
  const freeX = Math.max(workArea.width - bounds.width, 1);
  const freeY = Math.max(workArea.height - bounds.height, 1);
  return {
    posX: clampPercent(((bounds.x - workArea.x) / freeX) * 100),
    posY: clampPercent(((bounds.y - workArea.y) / freeY) * 100),
  };
}

export function createOverlayWindow(config: AppConfig, showOnReady: boolean): BrowserWindow {
  const win = new BrowserWindow({
    ...boundsFromConfig(config),

    transparent: true,
    frame: false,
    hasShadow: false,
    backgroundColor: '#00000000',

    alwaysOnTop: true,
    skipTaskbar: true,
    // Keeps the overlay out of Alt-Tab and stops it stealing focus from games.
    focusable: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    acceptFirstMouse: false,
    show: false,

    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Electron throttles unfocused windows to roughly 1fps. This window is
      // never focused, so without this the word highlight silently stops moving.
      backgroundThrottling: false,
    },
  });

  // Plain alwaysOnTop loses to some fullscreen apps; the screen-saver level does not.
  win.setAlwaysOnTop(true, 'screen-saver');
  // forward:true still delivers mousemove to the renderer while clicks pass through.
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: !config.hideOnFullscreen });

  // showInactive, never show: showing normally would take focus from whatever
  // the user is actually doing, which is the one thing an overlay must not do.
  //
  // Triggered on whichever of ready-to-show and did-finish-load lands first.
  // ready-to-show alone is not enough: it fires on first paint, and a fully
  // transparent window with no opaque background can fail to produce one, which
  // leaves the window created, positioned and topmost but never shown -- the
  // process looks healthy and nothing appears on screen.
  let shown = false;
  const reveal = (): void => {
    if (shown || !showOnReady || win.isDestroyed()) return;
    shown = true;
    win.showInactive();
  };

  win.once('ready-to-show', reveal);
  win.webContents.once('did-finish-load', reveal);

  // electron-vite sets ELECTRON_RENDERER_URL in dev so the renderer comes from
  // the vite server with hot reload; a packaged build has no server and loads
  // the built file instead.
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  win.webContents.on('did-fail-load', (_event, code, description) => {
    // Silence here is what the missing load looked like: a healthy process and
    // an empty window. Make the next one say so.
    log.error(`renderer failed to load: ${code} ${description}`);
  });

  // Nothing in this window should ever navigate; a lyric provider link would
  // otherwise replace the overlay with a web page and leave no way back.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

/**
 * Interactive mode makes the overlay a real window again so it can be dragged,
 * resized and configured. Click-through is restored on the way out.
 */
export function setInteractive(win: BrowserWindow, interactive: boolean): void {
  win.setIgnoreMouseEvents(!interactive, { forward: true });
  win.setFocusable(interactive);
  win.setMovable(interactive);
  win.setResizable(interactive);
  if (interactive) win.focus();
}
