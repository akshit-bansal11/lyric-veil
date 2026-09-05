import type { LyricLine, PlaybackAnchor } from './types';

/** Beyond this the difference is a seek or a track change, not drift. */
export const HARD_RESYNC_THRESHOLD_MS = 700;
/** Fraction of the outstanding error absorbed per frame. */
export const EASE_RATE = 0.08;
/**
 * Start each word's wipe slightly early. Reading a word a hair before it is sung
 * feels right; a hair after feels broken. Applied at read time rather than baked
 * into the timings, so it also improves genuinely word-timed sources.
 */
export const LEAD_IN_MS = 60;
/** Below this the residual correction is imperceptible; stop chasing it. */
const SETTLED_MS = 1;

export interface ClockState {
  /** Currently displayed position, ms from track start. */
  positionMs: number;
  isPlaying: boolean;
  /** User-tunable, persisted. Positive = lyrics appear earlier. */
  offsetMs: number;
  /** Outstanding correction, bled off a little each frame. */
  pendingErrorMs: number;
}

export function createClockState(offsetMs: number): ClockState {
  return { positionMs: 0, isPlaying: false, offsetMs, pendingErrorMs: 0 };
}

/**
 * Advance one animation frame.
 *
 * Corrections are eased rather than snapped: snapping every second produces a
 * visible micro-jump in the word wipe, while easing ~8% of the error per frame
 * converges within a few hundred milliseconds and is invisible.
 */
export function advance(state: ClockState, dtMs: number): void {
  if (state.isPlaying) state.positionMs += dtMs;

  if (state.pendingErrorMs !== 0) {
    const step = state.pendingErrorMs * EASE_RATE;
    state.positionMs += step;
    state.pendingErrorMs -= step;
    if (Math.abs(state.pendingErrorMs) < SETTLED_MS) state.pendingErrorMs = 0;
  }
}

/**
 * Fold in a fresh sample from Spotify.
 *
 * `now` is passed rather than read so the behaviour is testable; it must be the
 * same clock `anchor.sampledAt` came from.
 */
export function applyAnchor(state: ClockState, anchor: PlaybackAnchor, now: number): void {
  state.isPlaying = anchor.isPlaying;

  // The sample was taken in the main process some milliseconds ago. Without this
  // term that latency becomes permanent drift the clock can never correct away.
  const truth = anchor.progressMs + (now - anchor.sampledAt);
  const error = truth - state.positionMs;

  if (Math.abs(error) > HARD_RESYNC_THRESHOLD_MS) {
    state.positionMs = truth;
    state.pendingErrorMs = 0;
  } else {
    state.pendingErrorMs = error;
  }
}

/** The value every renderer component should actually read. */
export function readPosition(state: ClockState): number {
  return state.positionMs + state.offsetMs + LEAD_IN_MS;
}

/**
 * Index of the last line that has started at time `t`, or -1 before the first.
 * Binary search: about ten comparisons on a long track, cheap enough to run on
 * every frame and far simpler than an incremental cursor that has to be
 * invalidated on every seek.
 */
export function findLineIndex(lines: LyricLine[], t: number): number {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const line = lines[mid];
    if (!line) break;
    if (line.startMs <= t) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}
