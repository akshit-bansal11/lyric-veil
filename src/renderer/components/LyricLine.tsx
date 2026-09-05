import { type ClockRef, readClock } from '@renderer/hooks/usePlaybackClock';
import { cn } from '@renderer/lib/cn';
import type { LyricLine as LyricLineModel } from '@shared/types';
import { type CSSProperties, useEffect, useRef } from 'react';
import { LyricWord } from './LyricWord';

export interface LyricLineProps {
  line: LyricLineModel;
  isActive: boolean;
  /** 0 for the active line, 1 for its neighbours, 2+ for everything further out. */
  distance: number;
  clock: ClockRef;
  /** False for plain lyrics, whose timings are invented. */
  animated: boolean;
  inactiveOpacity: number;
  className?: string;
}

function inactiveStyle(distance: number, inactiveOpacity: number): CSSProperties {
  const opacity = distance <= 1 ? inactiveOpacity : inactiveOpacity * 0.53;
  return {
    opacity,
    transform: `scale(${distance <= 1 ? 0.96 : 0.94})`,
    filter: distance >= 2 ? 'blur(1px)' : undefined,
  };
}

/**
 * A single lyric line.
 *
 * Only the active line is split into per-word spans. Every other line renders as
 * one span holding the whole text: on a sixty-word chorus that is the difference
 * between eight DOM nodes and four hundred, and nothing offscreen is animating.
 */
export function LyricLine({
  line,
  isActive,
  distance,
  clock,
  animated,
  inactiveOpacity,
  className,
}: LyricLineProps) {
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    if (!isActive || !animated) return;

    // Precompute the reciprocal so the loop multiplies instead of dividing.
    const spans = line.words.map((word) => ({
      startMs: word.startMs,
      inverseDuration: 1 / Math.max(word.endMs - word.startMs, 1),
    }));

    let raf = 0;
    const tick = (): void => {
      const t = readClock(clock);
      for (let i = 0; i < spans.length; i += 1) {
        const element = wordRefs.current[i];
        const span = spans[i];
        if (!element || !span) continue;
        const p = (t - span.startMs) * span.inverseDuration;
        element.style.setProperty('--p', String(p < 0 ? 0 : p > 1 ? 1 : p));
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isActive, animated, line.words, clock]);

  if (!isActive) {
    return (
      <p
        className={cn('lyric-line m-0 py-[0.18em] text-white', className)}
        style={inactiveStyle(distance, inactiveOpacity)}
      >
        {line.text}
      </p>
    );
  }

  return (
    <p className={cn('lyric-line m-0 py-[0.18em]', className)} style={{ opacity: 1 }}>
      {line.words.map((word, i) => (
        <LyricWord
          key={`${line.id}-${i}`}
          text={i === line.words.length - 1 ? word.text : `${word.text} `}
          animated={animated}
          ref={(element) => {
            wordRefs.current[i] = element;
          }}
        />
      ))}
    </p>
  );
}
