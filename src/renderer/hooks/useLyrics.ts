import { type AppConfig, DEFAULT_CONFIG } from '@shared/config';
import type { AppStatus, Lyrics, TrackInfo } from '@shared/types';
import { useEffect, useState } from 'react';

/** Current lyrics for the playing track, or null while loading or unavailable. */
export function useLyrics(): Lyrics | null {
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  useEffect(() => window.lyricVeil.onLyrics(setLyrics), []);
  return lyrics;
}

export function useStatus(): AppStatus {
  const [status, setStatus] = useState<AppStatus>('idle');
  useEffect(() => window.lyricVeil.onStatus(setStatus), []);
  return status;
}

export function useConfig(): AppConfig {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  useEffect(() => window.lyricVeil.onConfig(setConfig), []);
  return config;
}

export function useInteractiveMode(): boolean {
  const [interactive, setInteractive] = useState(false);
  useEffect(() => window.lyricVeil.onInteractiveMode(setInteractive), []);
  return interactive;
}

/**
 * The playing track. Sourced from the same anchor stream as the clock, but kept
 * in React state -- it changes once a song, and the status hint needs to render it.
 */
export function useTrack(): TrackInfo | null {
  const [track, setTrack] = useState<TrackInfo | null>(null);

  useEffect(
    () =>
      window.lyricVeil.onPlaybackAnchor((anchor) => {
        setTrack((current) => {
          const next = anchor.track;
          // Compare by id so a fresh object per poll does not re-render every second.
          if (current?.id === next?.id) return current;
          return next;
        });
      }),
    [],
  );

  return track;
}

/** Transient message shown after a hotkey, so the user is not adjusting blind. */
export function useToast(durationMs = 1400): string | null {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => window.lyricVeil.onToast(setToast), []);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), durationMs);
    return () => clearTimeout(timer);
  }, [toast, durationMs]);

  return toast;
}
