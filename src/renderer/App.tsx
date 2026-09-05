import { useActiveLine } from '@renderer/hooks/useActiveLine';
import {
  useConfig,
  useInteractiveMode,
  useLyrics,
  useStatus,
  useToast,
  useTrack,
} from '@renderer/hooks/useLyrics';
import { usePlaybackClock } from '@renderer/hooks/usePlaybackClock';
import { cn } from '@renderer/lib/cn';
import type { LyricLine } from '@shared/types';
import type { CSSProperties } from 'react';
import { LyricsStage } from './components/LyricsStage';
import { SettingsPanel } from './components/SettingsPanel';
import { StatusHint } from './components/StatusHint';

/** Stable identity, so the active-line effect does not restart on every render. */
const EMPTY_LINES: LyricLine[] = [];

export function App() {
  const config = useConfig();
  const status = useStatus();
  const track = useTrack();
  const lyrics = useLyrics();
  const interactive = useInteractiveMode();
  const toast = useToast();

  const clock = usePlaybackClock(config.offsetMs);
  const active = useActiveLine(lyrics?.lines ?? EMPTY_LINES, clock);

  const hasLyrics = lyrics !== null && lyrics.lines.length > 0;

  const rootStyle: CSSProperties = {
    fontSize: `${config.fontSizePx}px`,
    // Read by the font-family fallback chain in styles.css.
    ['--font-family' as string]: config.fontFamily,
    ['--rest-opacity' as string]: String(config.inactiveOpacity),
    textAlign: config.textAlign,
  };

  return (
    <div
      className={cn(
        'lyrics-root relative h-full w-full font-bold leading-[1.32] tracking-[-0.02em]',
        // The whole surface is a drag target in interactive mode, so the window
        // can be repositioned without hunting for a title bar it does not have.
        interactive && 'drag-handle',
      )}
      style={rootStyle}
    >
      {config.showBackdrop ? (
        <div className="lyrics-backdrop pointer-events-none absolute inset-0" />
      ) : null}

      {interactive ? (
        <div className="pointer-events-none absolute inset-0 rounded-lg border border-white/20 border-dashed" />
      ) : null}

      <div className="relative h-full w-full px-6 py-4">
        {hasLyrics ? (
          <LyricsStage lyrics={lyrics} active={active} clock={clock} config={config} />
        ) : (
          <div className="flex h-full items-center">
            <StatusHint status={status} track={track} interactive={interactive} />
          </div>
        )}
      </div>

      {interactive ? <SettingsPanel config={config} className="absolute top-3 right-3" /> : null}

      {toast ? (
        <div className="pointer-events-none absolute bottom-3 left-6 rounded-full bg-black/60 px-3 py-1 text-[0.4em] text-white/90">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
