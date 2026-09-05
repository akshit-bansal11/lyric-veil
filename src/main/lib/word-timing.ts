import { type LyricLine, type LyricWord, MAX_LINE_MS } from '@shared/types';

/** Floor so a short word never flashes by unreadably. */
export const MIN_WORD_MS = 90;

/**
 * A line the parser produced but has not yet been given an end time or words.
 * `words` is present only for enhanced LRC, where the source carries per-word starts.
 */
export interface RawLine {
  startMs: number;
  text: string;
  /** Enhanced-LRC word starts, aligned 1:1 with the whitespace tokens of `text`. */
  wordStartsMs?: number[];
}

/**
 * Distribute a line's duration across its words by character weight.
 *
 * Every word is first given MIN_WORD_MS, and only the surplus is weighted. That
 * guarantees the slices sum to exactly the line duration while never dropping a
 * word below the floor -- weighting first and clamping afterwards does not, and
 * overruns the line end on any line mixing very long and very short words.
 *
 * The returned words always span [lineStartMs, lineStartMs + duration]. When the
 * requested duration is too short to give every word its floor, the span is
 * widened; the caller is responsible for taking the line's end from the last word.
 */
export function synthesizeWordTimings(
  text: string,
  lineStartMs: number,
  lineEndMs: number,
): LyricWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const duration = Math.max(lineEndMs - lineStartMs, MIN_WORD_MS * tokens.length);
  const surplus = duration - MIN_WORD_MS * tokens.length;

  // +1 approximates the inter-word pause; longer words genuinely take longer to sing.
  const weights = tokens.map((t) => t.length + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const endOfLine = lineStartMs + duration;
  let cursor = lineStartMs;

  return tokens.map((token, i) => {
    const weight = weights[i] ?? 1;
    const slice = MIN_WORD_MS + (weight / totalWeight) * surplus;
    const startMs = cursor;
    // Pin the final end rather than accumulating, so rounding cannot drift past the line.
    const endMs = i === tokens.length - 1 ? endOfLine : Math.round(cursor + slice);
    cursor = endMs;
    return { text: token, startMs, endMs, synthesized: true };
  });
}

/** Turn enhanced-LRC per-word start times into fully bounded words. */
function boundSourcedWords(
  text: string,
  startsMs: number[],
  lineStartMs: number,
  lineEndMs: number,
): LyricWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length !== startsMs.length) return [];

  return tokens.map((token, i) => {
    const startMs = Math.max(startsMs[i] ?? lineStartMs, lineStartMs);
    const nextStart = startsMs[i + 1];
    const rawEnd = i === tokens.length - 1 ? lineEndMs : (nextStart ?? lineEndMs);
    return {
      text: token,
      startMs,
      endMs: Math.max(rawEnd, startMs + MIN_WORD_MS),
      synthesized: false,
    };
  });
}

/**
 * Derive line ends, attach words, and enforce every invariant the renderer relies on.
 *
 * The clamp to MAX_LINE_MS is what stops a line before a 40-second instrumental
 * break from staying lit for the whole break with the wipe crawling across it.
 */
export function normalizeLines(raw: RawLine[], trackDurationMs: number): LyricLine[] {
  const sorted = [...raw]
    .filter((line) => line.text.trim().length > 0)
    .sort((a, b) => a.startMs - b.startMs);

  const lines: LyricLine[] = [];

  for (const [i, line] of sorted.entries()) {
    const next = sorted[i + 1];
    const hardCap = line.startMs + MAX_LINE_MS;
    const naturalEnd = next
      ? Math.min(next.startMs, hardCap)
      : Math.min(trackDurationMs > line.startMs ? trackDurationMs : hardCap, hardCap);

    const words =
      line.wordStartsMs && line.wordStartsMs.length > 0
        ? boundSourcedWords(line.text, line.wordStartsMs, line.startMs, naturalEnd)
        : synthesizeWordTimings(line.text, line.startMs, naturalEnd);

    if (words.length === 0) continue;

    const first = words[0];
    const last = words[words.length - 1];
    if (!first || !last) continue;

    lines.push({
      id: `${line.startMs}-${i}`,
      startMs: first.startMs,
      endMs: last.endMs,
      words,
      text: words.map((w) => w.text).join(' '),
    });
  }

  return lines;
}

/**
 * Throw on any broken invariant. A normalization bug that reaches the renderer
 * produces subtly wrong animation that is very hard to debug by eye, so this
 * fails loudly outside production rather than rendering something plausible.
 */
export function assertInvariants(lines: LyricLine[]): void {
  for (const [i, line] of lines.entries()) {
    if (line.words.length === 0) throw new Error(`line ${i} has no words`);

    const first = line.words[0];
    const last = line.words[line.words.length - 1];
    if (!first || !last) throw new Error(`line ${i} word bounds missing`);
    if (first.startMs !== line.startMs) throw new Error(`line ${i} start != first word start`);
    if (last.endMs !== line.endMs) throw new Error(`line ${i} end != last word end`);
    if (line.endMs <= line.startMs) throw new Error(`line ${i} has non-positive duration`);

    for (const [w, word] of line.words.entries()) {
      if (word.endMs <= word.startMs) throw new Error(`line ${i} word ${w} has non-positive span`);
    }

    const prev = lines[i - 1];
    if (prev && line.startMs < prev.startMs) throw new Error(`line ${i} is out of order`);
  }
}
