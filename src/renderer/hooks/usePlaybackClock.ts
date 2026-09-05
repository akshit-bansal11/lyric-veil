import {
  type ClockState,
  advance,
  applyAnchor,
  createClockState,
  readPosition,
} from '@shared/timeline';
import { useEffect, useRef } from 'react';

export type ClockRef = { readonly current: ClockState };

/** The value every renderer component should actually read. */
export function readClock(clock: ClockRef): number {
  return readPosition(clock.current);
}

/**
 * A high-resolution clock anchored to Spotify's once-per-second samples.
 *
 * Spotify is polled at 1Hz; rendering at 1Hz would be unwatchable. So the poll
 * supplies an anchor and this extrapolates between anchors at frame rate. The
 * arithmetic lives in clock-math so it can be tested without a DOM.
 *
 * positionMs deliberately lives in a ref, never in React state: writing it to
 * state would re-render the tree sixty times a second.
 */
export function usePlaybackClock(offsetMs: number): ClockRef {
  const clock = useRef<ClockState>(createClockState(offsetMs));

  // Config changes are rare; mirror the latest offset into the ref rather than
  // restarting the animation loop for it.
  clock.current.offsetMs = offsetMs;

  useEffect(() => {
    let raf = 0;
    let lastFrameAt = performance.now();

    const tick = (now: number): void => {
      advance(clock.current, now - lastFrameAt);
      lastFrameAt = now;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    const unsubscribe = window.lyricVeil.onPlaybackAnchor((anchor) => {
      applyAnchor(clock.current, anchor, Date.now());
    });

    return () => {
      cancelAnimationFrame(raf);
      unsubscribe();
    };
  }, []);

  return clock;
}
