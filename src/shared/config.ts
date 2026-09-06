export type TextAlign = 'left' | 'center' | 'right';

/**
 * 'word' lights the word being sung; 'line' lights the whole current line.
 * LRCLIB only carries line timing, so word timing is synthesized -- 'line' is
 * the mode that is actually exact for this source.
 */
export type HighlightMode = 'word' | 'line';

/** 127.0.0.1, not localhost -- Spotify rejects localhost for new redirect URIs. */
export const SPOTIFY_REDIRECT_PORT = 8888;
export const SPOTIFY_REDIRECT_URI = `http://127.0.0.1:${SPOTIFY_REDIRECT_PORT}/callback`;
export const SPOTIFY_DASHBOARD_URL = 'https://developer.spotify.com/dashboard';

/** Spotify client IDs are 32 alphanumeric characters. */
export function isValidClientId(value: string): boolean {
  return /^[0-9a-zA-Z]{32}$/.test(value.trim());
}

export interface AppConfig {
  /**
   * The user's own Spotify client ID. Empty until they provide one.
   *
   * Deliberately a setting rather than a build-time constant: a client ID
   * compiled into a public binary belongs to whoever built it, and Spotify
   * keeps new apps in development mode where only accounts on that app's
   * allowlist may sign in. Baking one in makes the release unusable for
   * everyone else.
   */
  spotifyClientId: string;

  /** User-tunable sync nudge, ms. Positive = lyrics appear earlier. */
  offsetMs: number;
  highlightMode: HighlightMode;
  /** Float above every other window, or sit in the normal stack and be covered by them. */
  alwaysOnTop: boolean;

  /** Colour of the word (or line) being sung. */
  textColor: string;
  /** Colour of everything else: the rest of the current line, and the other lines. */
  inactiveColor: string;
  /** Strength of the inactive colour. With white this is "the gray". */
  textOpacity: number;
  fontSizePx: number;
  fontFamily: string;
  /** CSS font-weight, 300-900. */
  fontWeight: number;
  /** Unitless CSS line-height. */
  lineHeight: number;
  /** CSS letter-spacing, in em. */
  letterSpacingEm: number;
  /** The readability shadow behind the text. Off is cleaner over a dark background. */
  textShadow: boolean;
  textAlign: TextAlign;

  /** Window position as a fraction of the free space on the primary display, 0-100. */
  posX: number;
  posY: number;
  width: number;
  height: number;

  bgColor: string;
  /** Opacity of the whole background layer, colour and image together. 0 = transparent. */
  bgOpacity: number;
  /** Absolute path chosen by the user, or null. The bytes are sent separately. */
  bgImagePath: string | null;

  hideOnFullscreen: boolean;
  launchOnStartup: boolean;
  linesAbove: number;
  linesBelow: number;
}

export const OFFSET_MIN_MS = -3000;
export const OFFSET_MAX_MS = 3000;

export const DEFAULT_CONFIG: AppConfig = {
  spotifyClientId: '',
  offsetMs: 0,
  highlightMode: 'word',
  alwaysOnTop: true,

  textColor: '#ffffff',
  inactiveColor: '#ffffff',
  textOpacity: 0.42,
  fontSizePx: 34,
  fontFamily: 'Segoe UI Variable Display',
  fontWeight: 700,
  lineHeight: 1.28,
  letterSpacingEm: -0.015,
  textShadow: true,
  textAlign: 'left',

  posX: 4,
  posY: 38,
  width: 820,
  height: 360,

  bgColor: '#000000',
  bgOpacity: 0,
  bgImagePath: null,

  hideOnFullscreen: true,
  launchOnStartup: false,
  linesAbove: 2,
  linesBelow: 4,
};

export function clampOffset(ms: number): number {
  return Math.min(Math.max(Math.round(ms), OFFSET_MIN_MS), OFFSET_MAX_MS);
}

export function clampPercent(value: number): number {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

/** `#rrggbb` to `r g b`, so a CSS `rgb(r g b / a)` can carry the opacity. */
export function hexToRgbTriplet(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match || !match[1]) return '255 255 255';
  const value = Number.parseInt(match[1], 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}
