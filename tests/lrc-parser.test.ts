import { describe, expect, it } from 'vitest';
import { parseLrc, parsePlain } from '../src/main/lib/lrc-parser';

describe('parseLrc', () => {
  it('reads a two-digit fraction as centiseconds', () => {
    const { lines } = parseLrc('[00:27.93] first line');
    expect(lines[0]?.startMs).toBe(27_930);
  });

  it('reads a three-digit fraction as milliseconds', () => {
    const { lines } = parseLrc('[00:27.930] first line');
    expect(lines[0]?.startMs).toBe(27_930);
  });

  it('accepts a colon as the fraction separator', () => {
    const { lines } = parseLrc('[01:05:50] a line');
    expect(lines[0]?.startMs).toBe(65_500);
  });

  it('parses enhanced LRC word markers', () => {
    const { lines, hasWordTiming } = parseLrc(
      '[00:27.93] <00:27.93> first <00:28.21> line <00:28.60> here',
    );
    expect(hasWordTiming).toBe(true);
    expect(lines[0]?.text).toBe('first line here');
    expect(lines[0]?.wordStartsMs).toEqual([27_930, 28_210, 28_600]);
  });

  it('ignores word markers that do not align 1:1 with the words', () => {
    const { lines, hasWordTiming } = parseLrc('[00:10.00] <00:10.00> two words here');
    expect(hasWordTiming).toBe(false);
    expect(lines[0]?.wordStartsMs).toBeUndefined();
    expect(lines[0]?.text).toBe('two words here');
  });

  it('applies an offset tag to every timestamp', () => {
    const { lines } = parseLrc('[offset:+500]\n[00:10.00] a\n[00:20.00] b');
    expect(lines.map((l) => l.startMs)).toEqual([10_500, 20_500]);
  });

  it('strips metadata tags and bracketed section markers', () => {
    const { lines } = parseLrc(
      '[ar:Someone]\n[ti:A Song]\n[by:Someone Else]\n[00:01.00] [Chorus]\n[00:02.00] real words',
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toBe('real words');
  });

  it('expands a line carrying several timestamps', () => {
    const { lines } = parseLrc('[00:10.00][01:10.00] refrain');
    expect(lines.map((l) => l.startMs)).toEqual([10_000, 70_000]);
    expect(lines.every((l) => l.text === 'refrain')).toBe(true);
  });

  it('skips malformed lines instead of throwing', () => {
    expect(() => parseLrc('not a lyric line\n[bad] also not\n[00:03.00] good')).not.toThrow();
    expect(parseLrc('nonsense\n[00:03.00] good').lines).toHaveLength(1);
  });

  it('drops empty lyric bodies', () => {
    expect(parseLrc('[00:05.00]   ').lines).toHaveLength(0);
  });
});

describe('parsePlain', () => {
  it('keeps non-empty lines and drops section markers', () => {
    expect(parsePlain('first\n\n[Chorus]\nsecond  ')).toEqual(['first', 'second']);
  });
});
