import type { AppConfig } from './config';
import type { AppStatus, Lyrics, PlaybackAnchor } from './types';

export const IPC = {
  // main -> renderer
  PLAYBACK_ANCHOR: 'playback:anchor',
  LYRICS_UPDATED: 'lyrics:updated',
  STATUS: 'app:status',
  CONFIG_UPDATED: 'config:updated',
  INTERACTIVE_MODE: 'window:interactive',
  TOAST: 'app:toast',

  // renderer -> main
  ADJUST_OFFSET: 'config:adjust-offset',
  SET_CONFIG: 'config:set',
  START_AUTH: 'auth:start',
  QUIT: 'app:quit',
} as const;

export type Unsubscribe = () => void;

export interface LyricVeilBridge {
  onPlaybackAnchor: (cb: (anchor: PlaybackAnchor) => void) => Unsubscribe;
  onLyrics: (cb: (lyrics: Lyrics | null) => void) => Unsubscribe;
  onStatus: (cb: (status: AppStatus) => void) => Unsubscribe;
  onConfig: (cb: (config: AppConfig) => void) => Unsubscribe;
  onInteractiveMode: (cb: (interactive: boolean) => void) => Unsubscribe;
  onToast: (cb: (message: string) => void) => Unsubscribe;
  adjustOffset: (deltaMs: number) => void;
  setConfig: (patch: Partial<AppConfig>) => void;
  startAuth: () => void;
  quit: () => void;
}
