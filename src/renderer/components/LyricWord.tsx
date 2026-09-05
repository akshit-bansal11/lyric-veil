import { cn } from '@renderer/lib/cn';
import { forwardRef } from 'react';

export interface LyricWordProps {
  text: string;
  /** Static words skip the gradient wipe entirely; see styles.css. */
  animated: boolean;
  className?: string;
}

/**
 * One word of the active line. Deliberately dumb: it renders text and exposes
 * its element. The `--p` progress value is written straight to the DOM node by
 * the parent's animation frame loop, never through props -- a prop would mean a
 * React render per word per frame.
 */
export const LyricWord = forwardRef<HTMLSpanElement, LyricWordProps>(function LyricWord(
  { text, animated, className },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        'inline-block whitespace-pre',
        animated ? 'lyric-word' : 'lyric-word-static',
        className,
      )}
    >
      {text}
    </span>
  );
});
