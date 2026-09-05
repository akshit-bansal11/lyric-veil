export type LyricsSyncLevel = 'word' | 'line' | 'plain' | 'none';

export interface LyricWord {
  /** Display text, no trailing space. */
  text: string;
  /** ms from track start. */
  startMs: number;
  /** ms from track start. Always > startMs. */
  endMs: number;
  /** True when the timing was synthesized rather than sourced. */
  synthesized: boolean;
}

export interface LyricLine {
  id: string;
  startMs: number;
  endMs: number;
  words: LyricWord[];
  /** Convenience: words joined with single spaces. */
  text: string;
}

export interface Lyrics {
  trackId: string;
  syncLevel: LyricsSyncLevel;
  /** 'LRCLIB' | 'synthesized' | 'none' -- free-form so a second provider can be added. */
  source: string;
  lines: LyricLine[];
  fetchedAt: number;
}

export interface TrackInfo {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
}

/**
 * A timestamp sample from Spotify. The renderer extrapolates from this
 * rather than polling; see usePlaybackClock.
 */
export interface PlaybackAnchor {
  track: TrackInfo | null;
  isPlaying: boolean;
  /** progress_ms reported by Spotify. */
  progressMs: number;
  /** Date.now() at the moment the HTTP response was received. */
  sampledAt: number;
}

export type AppStatus =
  | 'unconfigured'
  | 'unauthenticated'
  | 'idle'
  | 'playing'
  | 'no-lyrics'
  | 'unsupported'
  | 'error';

/** Gap after which the overlay shows progress dots instead of a lingering line. */
export const INTERLUDE_THRESHOLD_MS = 3000;

/** A line never stays lit longer than this, however long the gap to the next one. */
export const MAX_LINE_MS = 8000;
