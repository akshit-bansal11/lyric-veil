import { describe, expect, it } from 'vitest';
import {
  MIN_WORD_MS,
  type RawLine,
  assertInvariants,
  normalizeLines,
  synthesizeWordTimings,
} from '../src/main/lib/word-timing';
import { MAX_LINE_MS } from '../src/shared/types';

describe('synthesizeWordTimings', () => {
  it('covers the line exactly, with no gaps between words', () => {
    const words = synthesizeWordTimings('one two three four', 1000, 5000);
    expect(words[0]?.startMs).toBe(1000);
    expect(words.at(-1)?.endMs).toBe(5000);
    for (let i = 1; i < words.length; i += 1) {
      expect(words[i]?.startMs).toBe(words[i - 1]?.endMs);
    }
  });

  it('weights longer words with more time', () => {
    const [short, long] = synthesizeWordTimings('a extraordinarily', 0, 4000);
    const shortSpan = (short?.endMs ?? 0) - (short?.startMs ?? 0);
    const longSpan = (long?.endMs ?? 0) - (long?.startMs ?? 0);
    expect(longSpan).toBeGreaterThan(shortSpan);
  });

  it('respects the floor when the line is too short for its word count', () => {
    // Ten words in 100ms is impossible at the floor, so the span widens instead.
    const words = synthesizeWordTimings('a b c d e f g h i j', 0, 100);
    expect(words).toHaveLength(10);
    for (const word of words) {
      expect(word.endMs - word.startMs).toBeGreaterThanOrEqual(MIN_WORD_MS - 1);
    }
    expect(words.at(-1)?.endMs).toBe(MIN_WORD_MS * 10);
  });

  it('handles a single-word line', () => {
    const words = synthesizeWordTimings('alone', 500, 1500);
    expect(words).toHaveLength(1);
    expect(words[0]).toMatchObject({ startMs: 500, endMs: 1500, synthesized: true });
  });

  it('returns nothing for an empty string', () => {
    expect(synthesizeWordTimings('   ', 0, 1000)).toEqual([]);
  });
});

describe('normalizeLines', () => {
  const raw: RawLine[] = [
    { startMs: 2000, text: 'second line' },
    { startMs: 1000, text: 'first line' },
    { startMs: 4000, text: 'third line' },
  ];

  it('sorts lines and derives ends from the following line', () => {
    const lines = normalizeLines(raw, 60_000);
    expect(lines.map((l) => l.text)).toEqual(['first line', 'second line', 'third line']);
    expect(lines[0]?.endMs).toBe(2000);
    expect(lines[1]?.endMs).toBe(4000);
  });

  it('clamps a line before a long instrumental break', () => {
    const lines = normalizeLines(
      [
        { startMs: 0, text: 'lonely' },
        { startMs: 40_000, text: 'later' },
      ],
      60_000,
    );
    expect(lines[0]?.endMs).toBe(MAX_LINE_MS);
  });

  it('ends the last line no later than the track', () => {
    const lines = normalizeLines([{ startMs: 1000, text: 'the end' }], 3000);
    expect(lines.at(-1)?.endMs).toBe(3000);
  });

  it('uses sourced word starts when they are present', () => {
    const lines = normalizeLines(
      [
        { startMs: 1000, text: 'two words', wordStartsMs: [1000, 1600] },
        { startMs: 3000, text: 'next' },
      ],
      60_000,
    );
    expect(lines[0]?.words.map((w) => w.synthesized)).toEqual([false, false]);
    expect(lines[0]?.words[1]?.startMs).toBe(1600);
  });

  it('drops blank lines', () => {
    expect(normalizeLines([{ startMs: 0, text: '   ' }], 1000)).toHaveLength(0);
  });

  it('satisfies every invariant the renderer relies on', () => {
    const fixtures: RawLine[][] = [
      raw,
      [{ startMs: 0, text: 'single' }],
      [
        { startMs: 0, text: 'a b c d e f g h i j' },
        { startMs: 50, text: 'crowded' },
      ],
      [
        { startMs: 0, text: 'with words', wordStartsMs: [0, 10] },
        { startMs: 20, text: 'after' },
      ],
    ];
    for (const fixture of fixtures) {
      expect(() => assertInvariants(normalizeLines(fixture, 120_000))).not.toThrow();
    }
  });
});

describe('assertInvariants', () => {
  it('throws when a line end does not match its last word', () => {
    const lines = normalizeLines(raw(), 60_000);
    const first = lines[0];
    if (!first) throw new Error('fixture produced no lines');
    first.endMs += 500;
    expect(() => assertInvariants(lines)).toThrow(/end != last word end/);
  });

  function raw(): RawLine[] {
    return [
      { startMs: 0, text: 'a line' },
      { startMs: 2000, text: 'another' },
    ];
  }
});
