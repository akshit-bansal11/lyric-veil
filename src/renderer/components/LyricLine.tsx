import { type ClockRef, readClock } from '@renderer/hooks/usePlaybackClock';
import { cn } from '@renderer/lib/cn';
import { findWordIndex } from '@shared/timeline';
import type { LyricLine as LyricLineModel } from '@shared/types';
import { useEffect, useRef } from 'react';
import { LyricWord } from './LyricWord';

/**
 * How the active line is lit. 'none' is for plain lyrics whose timings are
 * invented: they get the dim treatment and never a highlight.
 */
export type LineHighlight = 'word' | 'line' | 'none';

export interface LyricLineProps {
  line: LyricLineModel;
  isActive: boolean;
  clock: ClockRef;
  highlight: LineHighlight;
  className?: string;
}

/**
 * A single lyric line.
 *
 * Only the active line in word mode is split into per-word spans. Every other
 * case renders as one element holding the whole text: on a sixty-word chorus
 * that is the difference between eight DOM nodes and four hundred, and nothing
 * offscreen has a loop running.
 */
export function LyricLine({ line, isActive, clock, highlight, className }: LyricLineProps) {
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const perWord = isActive && highlight === 'word';

  useEffect(() => {
    if (!perWord) return;

    let raf = 0;
    let current = -1;

    const mark = (index: number, on: boolean): void => {
      const element = wordRefs.current[index];
      if (element) element.dataset.current = on ? 'true' : 'false';
    };

    // Touches the DOM only when the current word actually changes -- a few times
    // a second -- rather than writing every word's state on every frame.
    const tick = (): void => {
      const next = findWordIndex(line.words, readClock(clock));
      if (next !== current) {
        if (current >= 0) mark(current, false);
        if (next >= 0) mark(next, true);
        current = next;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (current >= 0) mark(current, false);
    };
  }, [perWord, line.words, clock]);

  if (!perWord) {
    return (
      <p
        className={cn('lyric-line py-[0.14em]', className)}
        data-active={isActive ? 'true' : 'false'}
        data-highlight={isActive ? highlight : undefined}
      >
        {line.text}
      </p>
    );
  }

  return (
    <p className={cn('lyric-line py-[0.14em]', className)} data-active="true">
      {line.words.map((word, i) => (
        <LyricWord
          key={`${line.id}-${i}`}
          text={i === line.words.length - 1 ? word.text : `${word.text} `}
          ref={(element) => {
            wordRefs.current[i] = element;
          }}
        />
      ))}
    </p>
  );
}
