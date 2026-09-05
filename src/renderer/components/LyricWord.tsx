import { cn } from '@renderer/lib/cn';
import { forwardRef } from 'react';

export interface LyricWordProps {
  text: string;
  className?: string;
}

/**
 * One word of the active line. Deliberately dumb: it renders text and exposes
 * its element. Whether it is the word being sung is written straight onto the
 * DOM node as `data-current` by the parent's animation frame loop, never through
 * props -- a prop would mean a React render per word per frame.
 */
export const LyricWord = forwardRef<HTMLSpanElement, LyricWordProps>(function LyricWord(
  { text, className },
  ref,
) {
  return (
    <span ref={ref} className={cn('lyric-word inline-block whitespace-pre', className)}>
      {text}
    </span>
  );
});
