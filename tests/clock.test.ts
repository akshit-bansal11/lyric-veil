import { describe, expect, it } from 'vitest';
import {
  HARD_RESYNC_THRESHOLD_MS,
  LEAD_IN_MS,
  advance,
  applyAnchor,
  createClockState,
  findWordIndex,
  readPosition,
} from '../src/shared/timeline';
import type { LyricWord, PlaybackAnchor } from '../src/shared/types';

const NOW = 1_000_000;

function anchor(overrides: Partial<PlaybackAnchor> = {}): PlaybackAnchor {
  return {
    track: null,
    isPlaying: true,
    progressMs: 0,
    sampledAt: NOW,
    ...overrides,
  };
}

describe('clock', () => {
  it('advances with elapsed time while playing', () => {
    const state = createClockState(0);
    state.isPlaying = true;
    advance(state, 16);
    advance(state, 16);
    expect(state.positionMs).toBe(32);
  });

  it('freezes while paused', () => {
    const state = createClockState(0);
    state.positionMs = 5000;
    state.isPlaying = false;
    advance(state, 500);
    expect(state.positionMs).toBe(5000);
  });

  it('compensates for the age of the sample', () => {
    const state = createClockState(0);
    // Sample taken 120ms ago reporting 10s: the true position is 10.12s.
    applyAnchor(state, anchor({ progressMs: 10_000, sampledAt: NOW - 120 }), NOW);
    expect(state.positionMs + state.pendingErrorMs).toBeCloseTo(10_120, 0);
  });

  it('hard-resyncs on a forward seek', () => {
    const state = createClockState(0);
    state.positionMs = 10_000;
    applyAnchor(state, anchor({ progressMs: 60_000 }), NOW);
    expect(state.positionMs).toBe(60_000);
    expect(state.pendingErrorMs).toBe(0);
  });

  it('hard-resyncs on a backward seek', () => {
    const state = createClockState(0);
    state.positionMs = 60_000;
    applyAnchor(state, anchor({ progressMs: 1000 }), NOW);
    expect(state.positionMs).toBe(1000);
    expect(state.pendingErrorMs).toBe(0);
  });

  it('eases small drift instead of snapping', () => {
    const state = createClockState(0);
    state.positionMs = 10_000;
    applyAnchor(state, anchor({ progressMs: 10_200 }), NOW);
    // Nothing moves until a frame is drawn -- that is what makes it invisible.
    expect(state.positionMs).toBe(10_000);
    expect(state.pendingErrorMs).toBeCloseTo(200, 0);
  });

  it('converges 200ms of drift within twenty frames', () => {
    const state = createClockState(0);
    state.positionMs = 10_000;
    state.isPlaying = false;
    applyAnchor(state, anchor({ isPlaying: false, progressMs: 10_200 }), NOW);

    for (let frame = 0; frame < 20; frame += 1) advance(state, 16);

    expect(state.positionMs).toBeGreaterThan(10_160);
    expect(Math.abs(10_200 - state.positionMs)).toBeLessThan(40);
  });

  it('treats a difference just over the threshold as a seek', () => {
    const state = createClockState(0);
    state.positionMs = 0;
    applyAnchor(state, anchor({ progressMs: HARD_RESYNC_THRESHOLD_MS + 1 }), NOW);
    expect(state.pendingErrorMs).toBe(0);
  });

  it('applies the user offset and lead-in when read', () => {
    const state = createClockState(250);
    state.positionMs = 1000;
    expect(readPosition(state)).toBe(1000 + 250 + LEAD_IN_MS);
  });
});

describe('findWordIndex', () => {
  const words: LyricWord[] = [
    { text: 'one', startMs: 1000, endMs: 1400, synthesized: true },
    { text: 'two', startMs: 1400, endMs: 1900, synthesized: true },
    { text: 'three', startMs: 1900, endMs: 2600, synthesized: true },
  ];

  it('returns -1 before the first word', () => {
    expect(findWordIndex(words, 999)).toBe(-1);
  });

  it('finds the word whose span contains the time', () => {
    expect(findWordIndex(words, 1000)).toBe(0);
    expect(findWordIndex(words, 1399)).toBe(0);
    expect(findWordIndex(words, 1400)).toBe(1);
    expect(findWordIndex(words, 2599)).toBe(2);
  });

  it('returns -1 once the last word has ended', () => {
    expect(findWordIndex(words, 2600)).toBe(-1);
    expect(findWordIndex(words, 99_999)).toBe(-1);
  });

  it('handles an empty line', () => {
    expect(findWordIndex([], 1000)).toBe(-1);
  });
});
