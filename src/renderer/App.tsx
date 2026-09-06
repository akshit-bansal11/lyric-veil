import { useActiveLine } from '@renderer/hooks/useActiveLine';
import {
  useBackgroundImage,
  useConfig,
  useInteractiveMode,
  useLyrics,
  useStatus,
  useToast,
  useTrack,
} from '@renderer/hooks/useLyrics';
import { usePlaybackClock } from '@renderer/hooks/usePlaybackClock';
import { cn } from '@renderer/lib/cn';
import { hexToRgbTriplet } from '@shared/config';
import type { LyricLine } from '@shared/types';
import type { CSSProperties } from 'react';
import { LyricsStage } from './components/LyricsStage';
import { SettingsPanel } from './components/SettingsPanel';
import { StatusHint } from './components/StatusHint';

/** Stable identity, so the active-line effect does not restart on every render. */
const EMPTY_LINES: LyricLine[] = [];

/** Lines other than the current one sit a step further back than its unsung words. */
const FAR_LINE_FACTOR = 0.6;

export function App() {
  const config = useConfig();
  const status = useStatus();
  const track = useTrack();
  const lyrics = useLyrics();
  const interactive = useInteractiveMode();
  const toast = useToast();
  const backgroundImage = useBackgroundImage();

  const clock = usePlaybackClock(config.offsetMs);
  const active = useActiveLine(lyrics?.lines ?? EMPTY_LINES, clock);

  const hasLyrics = lyrics !== null && lyrics.lines.length > 0;

  // The only inline styles on the surface: values that come from user settings
  // and feed the CSS custom properties styles.css is written against.
  const rootStyle: CSSProperties = {
    fontSize: `${config.fontSizePx}px`,
    fontWeight: config.fontWeight,
    lineHeight: config.lineHeight,
    letterSpacing: `${config.letterSpacingEm}em`,
    textAlign: config.textAlign,
    ['--font-family' as string]: config.fontFamily,
    ['--text-rgb' as string]: hexToRgbTriplet(config.textColor),
    ['--inactive-rgb' as string]: hexToRgbTriplet(config.inactiveColor),
    ['--text-dim' as string]: String(config.textOpacity),
    ['--text-far' as string]: String(config.textOpacity * FAR_LINE_FACTOR),
  };

  const backgroundStyle: CSSProperties = {
    backgroundColor: config.bgColor,
    backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    opacity: config.bgOpacity,
  };

  return (
    <div
      className={cn(
        'relative h-full w-full',
        config.textShadow && 'lyrics-root',
        // The whole surface is a drag target in interactive mode, so the window
        // can be repositioned without hunting for a title bar it does not have.
        interactive && 'drag-handle',
      )}
      style={rootStyle}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl" style={backgroundStyle} />

      {interactive ? (
        <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/25 border-dashed" />
      ) : null}

      <div className="relative h-full w-full px-7 py-5">
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
        <div className="pointer-events-none absolute bottom-3 left-7 rounded-full bg-black/60 px-3 py-1 text-[0.4em] text-white/90">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
