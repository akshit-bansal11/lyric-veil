import type { LyricLine, LyricWord, PlaybackAnchor } from './types';

/** Beyond this the difference is a seek or a track change, not drift. */
export const HARD_RESYNC_THRESHOLD_MS = 700;
/** Fraction of the outstanding correction absorbed per frame. */
export const EASE_RATE = 0.08;
/**
 * Start each word slightly early. Reading a word a hair before it is sung feels
 * right; a hair after feels broken. Applied at read time rather than baked into
 * the timings, so it also improves genuinely word-timed sources.
 */
export const LEAD_IN_MS = 60;
/**
 * Spotify's progress_ms jitters by this much from one poll to the next as a
 * matter of course. A correction smaller than this is chasing noise, and a
 * clock that chases noise visibly speeds up and slows down once a second.
 */
export const DEADBAND_MS = 90;
/** Anchors remembered for the median. Odd, so the median is a real sample. */
export const SAMPLE_WINDOW = 5;
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
  /** Errors of the most recent anchors, oldest first. */
  errorSamples: number[];
}

export function createClockState(offsetMs: number): ClockState {
  return { positionMs: 0, isPlaying: false, offsetMs, pendingErrorMs: 0, errorSamples: [] };
}

/**
 * Advance one animation frame.
 *
 * The position free-runs on the frame clock while playing; that clock is far
 * steadier than anything Spotify reports. Corrections are eased rather than
 * snapped, because a snap every second is a visible micro-jump.
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

function median(values: ReadonlyArray<number>): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const upper = sorted[mid] ?? 0;
  if (sorted.length % 2 === 1) return upper;
  return ((sorted[mid - 1] ?? 0) + upper) / 2;
}

/**
 * Fold in a fresh sample from Spotify.
 *
 * No single sample is trusted. The error against each of the last few anchors
 * is kept, and only the median of them -- and only when it clears the deadband
 * -- becomes a correction. One jittery poll therefore moves nothing; a real,
 * consistent drift is still caught within a few polls.
 *
 * `now` is passed rather than read so the behaviour is testable; it must be the
 * same clock `anchor.sampledAt` came from.
 */
export function applyAnchor(state: ClockState, anchor: PlaybackAnchor, now: number): void {
  const wasPlaying = state.isPlaying;
  state.isPlaying = anchor.isPlaying;

  // A paused position does not age. Adding elapsed time to a paused sample
  // pushed the clock forward on every poll while nothing was playing.
  const age = anchor.isPlaying ? now - anchor.sampledAt : 0;
  const truth = anchor.progressMs + age;
  const error = truth - state.positionMs;

  // A seek, a track change, or a play/pause edge: the old samples describe a
  // timeline that no longer exists, so snap and start the window over.
  if (Math.abs(error) > HARD_RESYNC_THRESHOLD_MS || wasPlaying !== anchor.isPlaying) {
    state.positionMs = truth;
    state.pendingErrorMs = 0;
    state.errorSamples.length = 0;
    return;
  }

  state.errorSamples.push(error);
  if (state.errorSamples.length > SAMPLE_WINDOW) state.errorSamples.shift();

  const drift = median(state.errorSamples);
  if (Math.abs(drift) <= DEADBAND_MS) return;

  state.pendingErrorMs = drift;
  // The correction is about to be absorbed into the position; shift the samples
  // by the same amount so they do not vote for it a second time.
  for (let i = 0; i < state.errorSamples.length; i += 1) {
    state.errorSamples[i] = (state.errorSamples[i] ?? 0) - drift;
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

/**
 * Index of the word being sung at time `t` within a line, or -1 when `t` falls
 * outside every word. Lines are short, so a linear scan is cheaper than the
 * bookkeeping a cursor would need to survive seeks.
 */
export function findWordIndex(words: ReadonlyArray<LyricWord>, t: number): number {
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    if (!word) break;
    if (t < word.startMs) return -1;
    if (t < word.endMs) return i;
  }
  return -1;
}
