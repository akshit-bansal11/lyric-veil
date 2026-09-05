import { cn } from '@renderer/lib/cn';
import type { AppStatus, TrackInfo } from '@shared/types';

export interface StatusHintProps {
  status: AppStatus;
  track: TrackInfo | null;
  interactive: boolean;
  className?: string;
}

interface Hint {
  title: string;
  detail?: string;
  action?: 'connect';
}

function hintFor(status: AppStatus, track: TrackInfo | null): Hint | null {
  switch (status) {
    case 'unconfigured':
      return {
        title: 'No Spotify client ID',
        detail: 'Add MAIN_VITE_SPOTIFY_CLIENT_ID to .env and restart.',
      };
    case 'unauthenticated':
      return {
        title: 'Connect Spotify',
        detail: 'Ctrl+Alt+L, then click to sign in.',
        action: 'connect',
      };
    case 'unsupported':
      return { title: 'No lyrics for this', detail: 'Podcasts and local files have no track ID.' };
    case 'no-lyrics':
      return track ? { title: track.title, detail: track.artist } : { title: 'No lyrics found' };
    case 'error':
      return { title: 'Lost contact with Spotify', detail: 'Retrying.' };
    case 'idle':
      return { title: 'Nothing playing' };
    default:
      return null;
  }
}

/**
 * The overlay's only chrome. Kept deliberately quiet: it is competing with a
 * desktop wallpaper for attention and losing is the correct outcome.
 */
export function StatusHint({ status, track, interactive, className }: StatusHintProps) {
  const hint = hintFor(status, track);
  if (!hint) return null;

  return (
    <div className={cn('flex flex-col gap-[0.15em] text-white/60', className)}>
      <p className="m-0 font-semibold text-white/80">{hint.title}</p>
      {hint.detail ? <p className="m-0 text-[0.5em] leading-snug">{hint.detail}</p> : null}
      {hint.action === 'connect' && interactive ? (
        <button
          type="button"
          onClick={() => window.lyricVeil.startAuth()}
          className="no-drag mt-[0.25em] w-fit rounded-full border border-white/30 px-[0.6em] py-[0.2em] text-[0.45em] text-white/90 transition-colors hover:border-white/60 hover:bg-white/10"
        >
          Sign in with Spotify
        </button>
      ) : null}
    </div>
  );
}
