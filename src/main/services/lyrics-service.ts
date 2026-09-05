import type { Lyrics, TrackInfo } from '@shared/types';
import { createLogger } from '../lib/logger';
import { parseLrc, parsePlain } from '../lib/lrc-parser';
import { fetchLyricRecord } from '../lib/lrclib';
import * as cache from '../lib/lyrics-cache';
import { type RawLine, assertInvariants, normalizeLines } from '../lib/word-timing';

const log = createLogger('lyrics');

const isDev = process.env.NODE_ENV !== 'production';

function emptyResult(trackId: string): Lyrics {
  return { trackId, syncLevel: 'none', source: 'none', lines: [], fetchedAt: Date.now() };
}

/**
 * Plain lyrics carry no timing at all. They are laid out at a fixed cadence so
 * the stage has something to render, but the sync level tells the renderer not
 * to animate a wipe across them -- a wipe on invented timing looks broken in a
 * way that static text does not.
 */
function layOutPlain(text: string, durationMs: number): RawLine[] {
  const lines = parsePlain(text);
  if (lines.length === 0) return [];
  const step = Math.max(Math.floor(durationMs / lines.length), 1000);
  return lines.map((line, i) => ({ startMs: i * step, text: line }));
}

/**
 * Resolve lyrics for a track: cache, then LRCLIB, then normalize into the
 * canonical model. Word timings are synthesized here rather than in the
 * renderer, so the renderer never has to know whether they were real.
 */
export async function resolveLyrics(track: TrackInfo): Promise<Lyrics> {
  const cached = cache.get(track.id);
  if (cached) {
    log.info(`cache hit for ${track.id} (${cached.syncLevel})`);
    return cached;
  }

  let result: Lyrics;
  try {
    const record = await fetchLyricRecord({
      title: track.title,
      artist: track.artist,
      album: track.album,
      durationMs: track.durationMs,
    });

    if (!record || record.instrumental) {
      result = emptyResult(track.id);
    } else if (record.syncedLyrics) {
      const parsed = parseLrc(record.syncedLyrics);
      const lines = normalizeLines(parsed.lines, track.durationMs);
      result = {
        trackId: track.id,
        // 'word' only when the source really carried per-word markers; everything
        // else is 'line', even though both render through the same wipe.
        syncLevel: lines.length === 0 ? 'none' : parsed.hasWordTiming ? 'word' : 'line',
        source: lines.length === 0 ? 'none' : 'LRCLIB',
        lines,
        fetchedAt: Date.now(),
      };
    } else if (record.plainLyrics) {
      const lines = normalizeLines(
        layOutPlain(record.plainLyrics, track.durationMs),
        track.durationMs,
      );
      result = {
        trackId: track.id,
        syncLevel: lines.length === 0 ? 'none' : 'plain',
        source: lines.length === 0 ? 'none' : 'LRCLIB',
        lines,
        fetchedAt: Date.now(),
      };
    } else {
      result = emptyResult(track.id);
    }
  } catch (error) {
    log.warn(`lyrics lookup failed for ${track.id}`, error);
    // Not cached: a network failure is not evidence the track has no lyrics.
    return emptyResult(track.id);
  }

  if (isDev) assertInvariants(result.lines);

  cache.set(result);
  log.info(`resolved ${track.id} as ${result.syncLevel} from ${result.source}`);
  return result;
}

export { evictOverflow } from '../lib/lyrics-cache';
