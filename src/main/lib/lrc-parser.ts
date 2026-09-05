import type { RawLine } from './word-timing';

/** `[ti:]`, `[ar:]` and friends. `[offset:]` is the only one that changes timing. */
const METADATA_RE = /^\[([a-zA-Z]+):(.*)\]$/;
/** One leading `[mm:ss.xx]`. A line may carry several. */
const LINE_TAG_RE = /^\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/;
/** An inline `<mm:ss.xx>` word marker (enhanced LRC). */
const WORD_TAG_RE = /<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>/g;
/** A bracketed annotation with no timestamp: `[Chorus]`, `[Verse 2]`, `[Instrumental]`. */
const SECTION_RE = /^\[[^\]]*\]$/;

/**
 * A fractional part is centiseconds at two digits and milliseconds at three --
 * reading `[00:27.93]` as 93ms rather than 930ms puts every line a second early.
 */
function fractionToMs(frac: string | undefined): number {
  if (!frac) return 0;
  if (frac.length === 1) return Number(frac) * 100;
  if (frac.length === 2) return Number(frac) * 10;
  return Number(frac);
}

function toMs(minutes: string, seconds: string, frac: string | undefined): number {
  return Number(minutes) * 60_000 + Number(seconds) * 1000 + fractionToMs(frac);
}

export interface ParsedLrc {
  lines: RawLine[];
  /** True when at least one line carried inline word markers. */
  hasWordTiming: boolean;
}

/**
 * Parse standard LRC and enhanced LRC (ELRC) into raw lines.
 *
 * Malformed lines are skipped rather than thrown on: lyric files in the wild are
 * routinely half-broken, and one bad line should not cost the whole track.
 *
 * `[offset:]` is applied as `timestamp + offset`. The LRC convention is genuinely
 * ambiguous about the sign, and providers disagree; the manual offset hotkey is
 * the escape hatch for a file that reads the other way.
 */
export function parseLrc(content: string): ParsedLrc {
  const lines: RawLine[] = [];
  let offsetMs = 0;
  let hasWordTiming = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed.length === 0) continue;

    const metadata = METADATA_RE.exec(trimmed);
    if (metadata) {
      if (metadata[1]?.toLowerCase() === 'offset') {
        const parsed = Number.parseInt(metadata[2] ?? '', 10);
        if (Number.isFinite(parsed)) offsetMs = parsed;
      }
      continue;
    }

    // Consume every leading timestamp; `[00:12.00][01:44.00] refrain` is legal LRC.
    const starts: number[] = [];
    let rest = trimmed;
    for (;;) {
      const tag = LINE_TAG_RE.exec(rest);
      if (!tag) break;
      starts.push(toMs(tag[1] ?? '0', tag[2] ?? '0', tag[3]));
      rest = rest.slice(tag[0].length);
    }
    if (starts.length === 0) continue;

    rest = rest.trim();
    if (rest.length === 0 || SECTION_RE.test(rest)) continue;

    const wordStartsMs: number[] = [];
    WORD_TAG_RE.lastIndex = 0;
    for (const match of rest.matchAll(WORD_TAG_RE)) {
      wordStartsMs.push(toMs(match[1] ?? '0', match[2] ?? '0', match[3]));
    }

    const text = rest.replace(WORD_TAG_RE, ' ').replace(/\s+/g, ' ').trim();
    if (text.length === 0) continue;

    const tokenCount = text.split(' ').length;
    // Trust word markers only when they line up 1:1 with the words they bound.
    const usable = wordStartsMs.length === tokenCount;
    if (usable) hasWordTiming = true;

    for (const start of starts) {
      const startMs = start + offsetMs;
      lines.push(
        usable
          ? { startMs, text, wordStartsMs: wordStartsMs.map((w) => w + offsetMs) }
          : { startMs, text },
      );
    }
  }

  return { lines, hasWordTiming };
}

/** Split a plain-text lyric body into lines, for the unsynced fallback. */
export function parsePlain(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !SECTION_RE.test(line));
}
