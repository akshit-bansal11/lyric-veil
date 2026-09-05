import type { ActiveLine } from '@renderer/hooks/useActiveLine';
import type { ClockRef } from '@renderer/hooks/usePlaybackClock';
import { cn } from '@renderer/lib/cn';
import type { AppConfig } from '@shared/config';
import { INTERLUDE_THRESHOLD_MS, type Lyrics } from '@shared/types';
import { useLayoutEffect, useRef, useState } from 'react';
import { InterludeDots } from './InterludeDots';
import { LyricLine } from './LyricLine';

export interface LyricsStageProps {
  lyrics: Lyrics;
  active: ActiveLine;
  clock: ClockRef;
  config: AppConfig;
  className?: string;
}

/** Where the active line sits vertically, as a fraction of the window height. */
const ANCHOR_FRACTION = 0.34;

export function LyricsStage({ lyrics, active, clock, config, className }: LyricsStageProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const [translateY, setTranslateY] = useState(0);

  // Measured rather than computed from a fixed line height: a long line wraps,
  // and a stage that assumes uniform heights drifts a little further out of
  // alignment with every wrapped line above the active one.
  //
  // Deliberately no dependency array. This component only re-renders when the
  // active line, the track or the config changes -- a few times a minute -- and
  // every one of those changes moves the thing being measured. Listing them
  // instead would be a list that has to stay in sync with the layout by hand.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const activeElement = activeRef.current;
    if (!viewport || !activeElement) return;
    const anchor = viewport.clientHeight * ANCHOR_FRACTION;
    setTranslateY(anchor - activeElement.offsetTop);
  });

  const first = Math.max(0, active.index - config.linesAbove);
  const last = Math.min(lyrics.lines.length, Math.max(active.index, 0) + config.linesBelow + 1);
  const window = lyrics.lines.slice(first, last);

  // Plain lyrics carry invented timings, so no word is ever highlighted on them.
  const animated = lyrics.syncLevel !== 'plain';

  const activeLine = lyrics.lines[active.index];
  const nextLine = lyrics.lines[active.index + 1];
  const showInterlude =
    active.inGap &&
    activeLine !== undefined &&
    nextLine !== undefined &&
    nextLine.startMs - activeLine.endMs > INTERLUDE_THRESHOLD_MS;

  return (
    <div ref={viewportRef} className={cn('relative h-full w-full overflow-hidden', className)}>
      <div
        className="lyrics-stage absolute inset-x-0 top-0"
        style={{ transform: `translateY(${translateY}px)` }}
      >
        {window.map((line, i) => {
          const index = first + i;
          return (
            <div key={line.id} ref={index === active.index ? activeRef : undefined}>
              <LyricLine
                line={line}
                isActive={index === active.index && !active.inGap}
                clock={clock}
                animated={animated}
              />
              {showInterlude && index === active.index ? (
                <InterludeDots startMs={line.endMs} endMs={nextLine.startMs} clock={clock} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
