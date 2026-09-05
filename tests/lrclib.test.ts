import { describe, expect, it } from 'vitest';
import { cleanTitle, primaryArtist } from '../src/main/lib/lrclib';
import { findLineIndex } from '../src/shared/timeline';
import type { LyricLine } from '../src/shared/types';

describe('cleanTitle', () => {
  it.each([
    ['Song (Remastered 2011)', 'Song'],
    ['Song - Radio Edit', 'Song'],
    ['Song (feat. Someone)', 'Song'],
    ['Song (Live)', 'Song'],
    ['Song - 2019 Remaster', 'Song'],
    ['Song - Live at Wembley', 'Song'],
    ['Song', 'Song'],
  ])('reduces %s to %s', (input, expected) => {
    expect(cleanTitle(input)).toBe(expected);
  });

  it('leaves a parenthetical that is part of the actual title', () => {
    expect(cleanTitle('Sign o the Times (Prince)')).toBe('Sign o the Times (Prince)');
  });

  it('leaves a hyphen that is not a version suffix', () => {
    expect(cleanTitle('Jack-in-the-Box')).toBe('Jack-in-the-Box');
    expect(cleanTitle('Song - Part Two')).toBe('Song - Part Two');
  });
});

describe('primaryArtist', () => {
  it.each([
    ['A, B', 'A'],
    ['A & B', 'A'],
    ['A feat. B', 'A'],
    ['A with B', 'A'],
    ['Solo', 'Solo'],
  ])('reduces %s to %s', (input, expected) => {
    expect(primaryArtist(input)).toBe(expected);
  });
});

describe('findLineIndex', () => {
  const lines: LyricLine[] = [0, 1000, 2000, 3000].map((startMs, i) => ({
    id: String(i),
    startMs,
    endMs: startMs + 900,
    words: [],
    text: `line ${i}`,
  }));

  it('returns -1 before the first line', () => {
    expect(findLineIndex(lines, -1)).toBe(-1);
  });

  it('finds the line that has started', () => {
    expect(findLineIndex(lines, 0)).toBe(0);
    expect(findLineIndex(lines, 1500)).toBe(1);
    expect(findLineIndex(lines, 2000)).toBe(2);
  });

  it('stays on the last line past the end', () => {
    expect(findLineIndex(lines, 999_999)).toBe(3);
  });

  it('handles an empty list', () => {
    expect(findLineIndex([], 100)).toBe(-1);
  });
});
