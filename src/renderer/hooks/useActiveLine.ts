import { findLineIndex } from '@shared/timeline';
import type { LyricLine } from '@shared/types';
import { useEffect, useState } from 'react';
import { type ClockRef, readClock } from './usePlaybackClock';

export interface ActiveLine {
  index: number;
  /** True when the current position sits past the line's end, in an instrumental gap. */
  inGap: boolean;
}

/**
 * Track which line is active. This is the one thing in the render path that
 * belongs in React state -- it changes a few times a minute, not sixty times a
 * second, so a re-render here is free.
 */
export function useActiveLine(lines: LyricLine[], clock: ClockRef): ActiveLine {
  const [active, setActive] = useState<ActiveLine>({ index: -1, inGap: false });

  useEffect(() => {
    if (lines.length === 0) {
      setActive({ index: -1, inGap: false });
      return;
    }

    let raf = 0;
    let lastIndex = Number.NaN;
    let lastInGap: boolean | null = null;

    const tick = (): void => {
      const t = readClock(clock);
      const index = findLineIndex(lines, t);
      const line = index >= 0 ? lines[index] : undefined;
      const inGap = line ? t > line.endMs : false;

      // setState only on an actual transition; calling it every frame would
      // re-render the whole stage at frame rate and undo the point of the ref.
      if (index !== lastIndex || inGap !== lastInGap) {
        lastIndex = index;
        lastInGap = inGap;
        setActive({ index, inGap });
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lines, clock]);

  return active;
}
