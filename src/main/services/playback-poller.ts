import type { AppStatus, PlaybackAnchor, TrackInfo } from '@shared/types';
import { AuthError, forceRefresh, getAccessToken, isConfigured } from '../auth/spotify-auth';
import { createLogger } from '../lib/logger';
import { type PlayerState, SpotifyApiError, getPlayerState } from '../lib/spotify-api';

const log = createLogger('poller');

const PLAYING_INTERVAL_MS = 1000;
/** Slower while nothing is happening; this is pure API quota saved. */
const IDLE_INTERVAL_MS = 3000;
const BACKOFF_INTERVAL_MS = 10_000;
const ERRORS_BEFORE_BACKOFF = 3;

export interface PollerHandlers {
  onAnchor: (anchor: PlaybackAnchor) => void;
  onStatus: (status: AppStatus) => void;
  /** Fired only when the track identity actually changes, including to null. */
  onTrackChange: (track: TrackInfo | null) => void;
}

function toTrackInfo(state: PlayerState): TrackInfo | null {
  const item = state.item;
  if (!item || !item.id) return null;
  return {
    id: item.id,
    title: item.name,
    artist: item.artists.map((a) => a.name).join(', '),
    album: item.album.name,
    durationMs: item.duration_ms,
  };
}

export interface Poller {
  stop: () => void;
  /** Poll immediately instead of waiting out the current interval. */
  poke: () => void;
}

export function startPoller(handlers: PollerHandlers): Poller {
  let timer: NodeJS.Timeout | null = null;
  let stopped = false;
  let consecutiveErrors = 0;
  let lastTrackId: string | null = null;

  const schedule = (delayMs: number): void => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void tick(), delayMs);
  };

  const emitTrackChange = (track: TrackInfo | null): void => {
    const id = track?.id ?? null;
    if (id === lastTrackId) return;
    lastTrackId = id;
    handlers.onTrackChange(track);
  };

  /** One request, with a single 401 retry against a freshly refreshed token. */
  const fetchState = async (): Promise<PlayerState | null> => {
    const token = await getAccessToken();
    try {
      return await getPlayerState(token);
    } catch (error) {
      if (error instanceof SpotifyApiError && error.kind === 'auth') {
        return getPlayerState(await forceRefresh());
      }
      throw error;
    }
  };

  const tick = async (): Promise<void> => {
    if (stopped) return;

    if (!isConfigured()) {
      handlers.onStatus('unconfigured');
      schedule(BACKOFF_INTERVAL_MS);
      return;
    }

    try {
      const startedAt = Date.now();
      const state = await fetchState();
      const receivedAt = Date.now();
      consecutiveErrors = 0;

      // Spotify read its player state somewhere in the middle of the round trip.
      // Stamping the sample with the receipt time bakes the second half of that
      // trip -- typically 50 to 150ms -- into every anchor as permanent lag. The
      // midpoint is the honest estimate of when the number was true.
      const sampledAt = Math.round((startedAt + receivedAt) / 2);

      if (!state) {
        emitTrackChange(null);
        handlers.onAnchor({ track: null, isPlaying: false, progressMs: 0, sampledAt });
        handlers.onStatus('idle');
        schedule(IDLE_INTERVAL_MS);
        return;
      }

      const track = toTrackInfo(state);
      emitTrackChange(track);
      handlers.onAnchor({
        track,
        isPlaying: state.is_playing,
        progressMs: state.progress_ms ?? 0,
        sampledAt,
      });

      // A podcast or a local file has no Spotify track id, so there is nothing to look up.
      if (!track) handlers.onStatus('unsupported');
      else if (state.is_playing) handlers.onStatus('playing');
      else handlers.onStatus('idle');

      schedule(state.is_playing ? PLAYING_INTERVAL_MS : IDLE_INTERVAL_MS);
    } catch (error) {
      if (error instanceof AuthError) {
        handlers.onStatus('unauthenticated');
        schedule(IDLE_INTERVAL_MS);
        return;
      }

      if (error instanceof SpotifyApiError && error.kind === 'rate-limit') {
        // Honour Retry-After exactly; retrying sooner is how a soft limit becomes a hard one.
        log.warn(`rate limited, backing off ${error.retryAfterMs}ms`);
        schedule(error.retryAfterMs ?? BACKOFF_INTERVAL_MS);
        return;
      }

      consecutiveErrors += 1;
      log.warn(`poll failed (${consecutiveErrors})`, error);
      if (consecutiveErrors >= ERRORS_BEFORE_BACKOFF) handlers.onStatus('error');
      schedule(consecutiveErrors >= ERRORS_BEFORE_BACKOFF ? BACKOFF_INTERVAL_MS : IDLE_INTERVAL_MS);
    }
  };

  void tick();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
    poke: () => schedule(0),
  };
}
