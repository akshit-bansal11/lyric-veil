import type { AppConfig } from '@shared/config';
import { IPC, type LyricVeilBridge, type Unsubscribe } from '@shared/ipc';
import type { AppStatus, Lyrics, PlaybackAnchor } from '@shared/types';
import { type IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';

/**
 * Every subscription returns its own unsubscribe. Hot reload remounts the
 * renderer without tearing down the preload context, so a hook that forgets to
 * unsubscribe leaks a listener per reload and eventually trips Electron's
 * max-listeners warning.
 */
function subscribe<T>(channel: string, cb: (payload: T) => void): Unsubscribe {
  const listener = (_event: IpcRendererEvent, payload: T): void => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.off(channel, listener);
  };
}

const bridge: LyricVeilBridge = {
  onPlaybackAnchor: (cb) => subscribe<PlaybackAnchor>(IPC.PLAYBACK_ANCHOR, cb),
  onLyrics: (cb) => subscribe<Lyrics | null>(IPC.LYRICS_UPDATED, cb),
  onStatus: (cb) => subscribe<AppStatus>(IPC.STATUS, cb),
  onConfig: (cb) => subscribe<AppConfig>(IPC.CONFIG_UPDATED, cb),
  onInteractiveMode: (cb) => subscribe<boolean>(IPC.INTERACTIVE_MODE, cb),
  onToast: (cb) => subscribe<string>(IPC.TOAST, cb),

  adjustOffset: (deltaMs) => ipcRenderer.send(IPC.ADJUST_OFFSET, deltaMs),
  setConfig: (patch) => ipcRenderer.send(IPC.SET_CONFIG, patch),
  startAuth: () => ipcRenderer.send(IPC.START_AUTH),
  quit: () => ipcRenderer.send(IPC.QUIT),
};

contextBridge.exposeInMainWorld('lyricVeil', bridge);
