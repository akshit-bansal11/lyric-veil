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
  /** A data: URL for the chosen background image, or null when there is none. */
  BG_IMAGE: 'config:bg-image',

  // renderer -> main
  ADJUST_OFFSET: 'config:adjust-offset',
  SET_CONFIG: 'config:set',
  PICK_BG_IMAGE: 'config:pick-bg-image',
  CLEAR_BG_IMAGE: 'config:clear-bg-image',
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
  onBackgroundImage: (cb: (dataUrl: string | null) => void) => Unsubscribe;
  adjustOffset: (deltaMs: number) => void;
  setConfig: (patch: Partial<AppConfig>) => void;
  /** Opens a native file picker. Resolves true when an image was chosen and applied. */
  pickBackgroundImage: () => Promise<boolean>;
  clearBackgroundImage: () => void;
  startAuth: () => void;
  quit: () => void;
}
