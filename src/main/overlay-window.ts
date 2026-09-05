import { join } from 'node:path';
import type { AppConfig, WindowBounds } from '@shared/config';
import { BrowserWindow, screen, shell } from 'electron';

const DEFAULT_WIDTH = 820;
const DEFAULT_HEIGHT = 380;

function defaultBounds(): WindowBounds {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + 80,
    y: workArea.y + Math.round(workArea.height * 0.35),
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  };
}

export function createOverlayWindow(config: AppConfig, showOnReady: boolean): BrowserWindow {
  const bounds = config.bounds ?? defaultBounds();

  const win = new BrowserWindow({
    ...bounds,

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
      // never focused, so without this the word wipe silently stops animating.
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
  win.once('ready-to-show', () => {
    if (showOnReady) win.showInactive();
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

export function currentBounds(win: BrowserWindow): WindowBounds {
  const { x, y, width, height } = win.getBounds();
  return { x, y, width, height };
}
