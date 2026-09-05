import { type AppConfig, clampOffset } from '@shared/config';
import { IPC } from '@shared/ipc';
import type { AppStatus, Lyrics, PlaybackAnchor, TrackInfo } from '@shared/types';
import { type BrowserWindow, type Tray, app, shell } from 'electron';
import {
  AuthError,
  configureClientId,
  ensureAuthenticated,
  isConfigured,
} from './auth/spotify-auth';
import { registerHotkeys, unregisterHotkeys } from './hotkeys';
import { registerIpcHandlers } from './ipc-handlers';
import { createLogger } from './lib/logger';
import { createOverlayWindow, currentBounds, setInteractive } from './overlay-window';
import { evictOverflow, resolveLyrics } from './services/lyrics-service';
import { type Poller, startPoller } from './services/playback-poller';
import { readConfig, writeConfig } from './services/store';
import { createTray } from './tray';

const log = createLogger('main');

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let poller: Poller | null = null;
let config: AppConfig = { ...readConfig() };
let interactive = false;
/** `--hidden` is passed by the login-item entry so a startup launch is not intrusive. */
let visible = !process.argv.includes('--hidden');
let lastStatus: AppStatus | null = null;
/** Guards against a slow lyrics fetch landing after the track has already changed. */
let lyricsRequestId = 0;

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

function applyConfig(patch: Partial<AppConfig>): void {
  config = writeConfig(patch);

  if (patch.launchOnStartup !== undefined) {
    // Electron owns the registry entry; hand-rolling one drifts from what it expects.
    app.setLoginItemSettings({ openAtLogin: config.launchOnStartup, args: ['--hidden'] });
  }
  if (patch.hideOnFullscreen !== undefined && win) {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: !config.hideOnFullscreen });
  }

  pushConfig();
}

function adjustOffset(deltaMs: number): void {
  const next = clampOffset(config.offsetMs + deltaMs);
  if (next === config.offsetMs) return;
  applyConfig({ offsetMs: next });
  send(IPC.TOAST, `Sync offset ${next > 0 ? '+' : ''}${next} ms`);
}

function resetOffset(): void {
  applyConfig({ offsetMs: 0 });
  send(IPC.TOAST, 'Sync offset reset');
}

function toggleInteractive(): void {
  if (!win) return;
  interactive = !interactive;
  setInteractive(win, interactive);
  send(IPC.INTERACTIVE_MODE, interactive);
  // Leaving interactive mode is the only moment the user could have moved or
  // resized the window, so that is the moment worth persisting.
  if (!interactive) applyConfig({ bounds: currentBounds(win) });
}

function toggleVisible(): void {
  if (!win) return;
  visible = !visible;
  if (visible) win.showInactive();
  else win.hide();
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
  evictOverflow();

  registerIpcHandlers({
    adjustOffset,
    setConfig: (patch) => applyConfig(patch),
    startAuth: () => void startAuth(),
    quit,
  });

  registerHotkeys({ toggleInteractive, toggleVisible, adjustOffset, resetOffset });

  tray = createTray({
    isVisible: () => visible,
    toggleVisible,
    isInteractive: () => interactive,
    toggleInteractive,
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
