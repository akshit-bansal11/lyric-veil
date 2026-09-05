import { type ClockRef, readClock } from '@renderer/hooks/usePlaybackClock';
import { cn } from '@renderer/lib/cn';
import { useEffect, useRef } from 'react';

export interface InterludeDotsProps {
  startMs: number;
  endMs: number;
  clock: ClockRef;
  className?: string;
}

const DOTS = [0, 1, 2];

/**
 * Three dots that fill across an instrumental gap, driven by the same clock as
 * the word wipe. Without them a long break looks like the overlay has frozen.
 */
export function InterludeDots({ startMs, endMs, clock, className }: InterludeDotsProps) {
  const dotRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const inverseDuration = 1 / Math.max(endMs - startMs, 1);
    let raf = 0;

    const tick = (): void => {
      const progress = (readClock(clock) - startMs) * inverseDuration;
      for (const i of DOTS) {
        const element = dotRefs.current[i];
        if (!element) continue;
        // Each dot owns a third of the gap, so they light in sequence.
        const local = Math.min(Math.max(progress * DOTS.length - i, 0), 1);
        element.style.opacity = String(0.22 + local * 0.78);
        element.style.transform = `scale(${0.8 + local * 0.2})`;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startMs, endMs, clock]);

  return (
    <p className={cn('m-0 flex items-center gap-[0.35em] py-[0.3em]', className)}>
      {DOTS.map((i) => (
        <span
          key={i}
          ref={(element) => {
            dotRefs.current[i] = element;
          }}
          className="inline-block h-[0.34em] w-[0.34em] rounded-full bg-white"
        />
      ))}
    </p>
  );
}
