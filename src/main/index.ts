import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { type AppConfig, clampOffset } from '@shared/config';
import { IPC } from '@shared/ipc';
import type { AppStatus, Lyrics, PlaybackAnchor, TrackInfo } from '@shared/types';
import { type BrowserWindow, type Tray, app, dialog, shell } from 'electron';
import {
  AuthError,
  configureClientId,
  ensureAuthenticated,
  isConfigured,
} from './auth/spotify-auth';
import { registerHotkeys, unregisterHotkeys } from './hotkeys';
import { registerIpcHandlers } from './ipc-handlers';
import { createLogger } from './lib/logger';
import {
  boundsFromConfig,
  createOverlayWindow,
  percentFromBounds,
  setInteractive,
} from './overlay-window';
import { evictOverflow, resolveLyrics } from './services/lyrics-service';
import { type Poller, startPoller } from './services/playback-poller';
import { readConfig, writeConfig } from './services/store';
import { createTray } from './tray';

const log = createLogger('main');

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};
/** A data: URL is held in renderer memory; past this it costs more than it is worth. */
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let poller: Poller | null = null;
let config: AppConfig = readConfig();
let interactive = false;
/** `--hidden` is passed by the login-item entry so a startup launch is not intrusive. */
let visible = !process.argv.includes('--hidden');
let lastStatus: AppStatus | null = null;
/** Guards against a slow lyrics fetch landing after the track has already changed. */
let lyricsRequestId = 0;
/** The background image bytes, kept out of the persisted config. */
let bgImageDataUrl: string | null = null;

function send(channel: string, payload?: unknown): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function pushStatus(status: AppStatus): void {
  if (status === lastStatus) return;
  lastStatus = status;
  send(IPC.STATUS, status);
}

function pushConfig(): void {
  send(IPC.CONFIG_UPDATED, config);
}

/** Persist and broadcast, with no window side effects. */
function commitConfig(patch: Partial<AppConfig>): void {
  config = writeConfig(patch);
  pushConfig();
}

/** Persist, broadcast, and apply whatever the change means for the window. */
function applyConfig(patch: Partial<AppConfig>): void {
  commitConfig(patch);

  if (win && ('posX' in patch || 'posY' in patch || 'width' in patch || 'height' in patch)) {
    win.setBounds(boundsFromConfig(config));
  }
  if (patch.launchOnStartup !== undefined) {
    // Electron owns the registry entry; hand-rolling one drifts from what it expects.
    app.setLoginItemSettings({ openAtLogin: config.launchOnStartup, args: ['--hidden'] });
  }
  if (patch.hideOnFullscreen !== undefined && win) {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: !config.hideOnFullscreen });
  }
  if (patch.alwaysOnTop !== undefined) applyZOrder();
}

/**
 * Above every window, or in the normal stack where any window the user touches
 * covers it. Interactive mode is always on top, so the panel can be reached.
 * Either way the overlay survives Win+D; see the minimize handler in overlay-window.
 */
function applyZOrder(): void {
  if (!win || win.isDestroyed()) return;
  win.setAlwaysOnTop(config.alwaysOnTop || interactive, 'screen-saver');
}

/** The user dragged or resized the window: record where it ended up. */
function syncBoundsFromWindow(): void {
  if (!win) return;
  const bounds = win.getBounds();
  const next = { ...percentFromBounds(bounds), width: bounds.width, height: bounds.height };
  const changed =
    next.posX !== config.posX ||
    next.posY !== config.posY ||
    next.width !== config.width ||
    next.height !== config.height;
  // A programmatic setBounds also fires these events; only a real change is recorded.
  if (changed) commitConfig(next);
}

function adjustOffset(deltaMs: number): void {
  const next = clampOffset(config.offsetMs + deltaMs);
  if (next === config.offsetMs) return;
  commitConfig({ offsetMs: next });
  send(IPC.TOAST, `Sync offset ${next > 0 ? '+' : ''}${next} ms`);
}

function resetOffset(): void {
  commitConfig({ offsetMs: 0 });
  send(IPC.TOAST, 'Sync offset reset');
}

function toggleInteractive(): void {
  if (!win) return;
  interactive = !interactive;
  send(IPC.INTERACTIVE_MODE, interactive);
  applyZOrder();
  setInteractive(win, interactive);
}

function toggleVisible(): void {
  if (!win) return;
  visible = !visible;
  if (visible) win.showInactive();
  else win.hide();
}

function loadBackgroundImage(path: string | null): string | null {
  if (!path) return null;
  const mime = IMAGE_MIME[extname(path).slice(1).toLowerCase()];
  if (!mime) return null;
  try {
    const bytes = readFileSync(path);
    if (bytes.length > MAX_IMAGE_BYTES) {
      log.warn(`background image too large: ${bytes.length} bytes`);
      return null;
    }
    return `data:${mime};base64,${bytes.toString('base64')}`;
  } catch (error) {
    log.warn('background image unreadable', error);
    return null;
  }
}

function pushBackgroundImage(): void {
  send(IPC.BG_IMAGE, bgImageDataUrl);
}

async function pickBackgroundImage(): Promise<boolean> {
  const result = await dialog.showOpenDialog({
    title: 'Choose a background image',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: Object.keys(IMAGE_MIME) }],
  });
  const file = result.filePaths[0];
  if (result.canceled || !file) return false;

  const dataUrl = loadBackgroundImage(file);
  if (!dataUrl) {
    send(IPC.TOAST, 'Could not use that image (PNG, JPG, WebP or GIF, up to 12 MB)');
    return false;
  }

  bgImageDataUrl = dataUrl;
  commitConfig({ bgImagePath: file });
  pushBackgroundImage();
  return true;
}

function clearBackgroundImage(): void {
  bgImageDataUrl = null;
  commitConfig({ bgImagePath: null });
  pushBackgroundImage();
}

async function onTrackChange(track: TrackInfo | null): Promise<void> {
  const requestId = ++lyricsRequestId;

  if (!track) {
    send(IPC.LYRICS_UPDATED, null);
    return;
  }

  send(IPC.LYRICS_UPDATED, null);
  const lyrics: Lyrics = await resolveLyrics(track);

  // A track change during the fetch makes this result stale; drop it silently.
  if (requestId !== lyricsRequestId) return;

  send(IPC.LYRICS_UPDATED, lyrics);
  if (lyrics.syncLevel === 'none') pushStatus('no-lyrics');
}

async function startAuth(): Promise<void> {
  try {
    await ensureAuthenticated();
    poller?.poke();
  } catch (error) {
    if (error instanceof AuthError) {
      log.warn('authentication failed', error);
      pushStatus(isConfigured() ? 'unauthenticated' : 'unconfigured');
    } else {
      log.error('authentication error', error);
      pushStatus('error');
    }
  }
}

function quit(): void {
  poller?.stop();
  unregisterHotkeys();
  tray?.destroy();
  app.quit();
}

function bootstrap(): void {
  // Injected by electron-vite from .env at build time; absent until the user adds one.
  configureClientId(import.meta.env.MAIN_VITE_SPOTIFY_CLIENT_ID);

  win = createOverlayWindow(config, visible);
  win.on('moved', syncBoundsFromWindow);
  win.on('resized', syncBoundsFromWindow);
  evictOverflow();
  bgImageDataUrl = loadBackgroundImage(config.bgImagePath);

  registerIpcHandlers({
    adjustOffset,
    setConfig: applyConfig,
    pickBackgroundImage,
    clearBackgroundImage,
    startAuth: () => void startAuth(),
    quit,
  });

  registerHotkeys({ toggleInteractive, toggleVisible, adjustOffset, resetOffset });

  tray = createTray({
    isVisible: () => visible,
    toggleVisible,
    isInteractive: () => interactive,
    toggleInteractive,
    getConfig: () => config,
    setConfig: applyConfig,
    resetOffset,
    reconnect: () => void startAuth(),
    openLogs: () => void shell.openPath(app.getPath('logs')),
    quit,
  });

  poller = startPoller({
    onAnchor: (anchor: PlaybackAnchor) => send(IPC.PLAYBACK_ANCHOR, anchor),
    onStatus: pushStatus,
    onTrackChange: (track) => void onTrackChange(track),
  });

  win.webContents.once('did-finish-load', () => {
    pushConfig();
    pushBackgroundImage();
    if (lastStatus) send(IPC.STATUS, lastStatus);
  });

  // Silent refresh on launch; only falls through to a browser when there is no
  // usable refresh token, which is the one case that genuinely needs the user.
  if (isConfigured()) void startAuth();
  else pushStatus('unconfigured');

  log.info('overlay started');
}

// A second instance would fight the first for the loopback port and the hotkeys.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win && !visible) toggleVisible();
  });

  void app.whenReady().then(bootstrap);

  // The overlay lives in the tray; closing its window must not end the process.
  app.on('window-all-closed', () => {
    /* intentionally empty */
  });

  app.on('will-quit', unregisterHotkeys);
}
