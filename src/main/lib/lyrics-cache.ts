import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { Lyrics } from '@shared/types';
import { app } from 'electron';
import { createLogger } from './logger';

const log = createLogger('cache');

/** Successful lyrics never expire -- they do not change. */
const NEGATIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 2000;

let cacheDir: string | null = null;

function dir(): string {
  if (cacheDir) return cacheDir;
  cacheDir = join(app.getPath('userData'), 'lyrics-cache');
  mkdirSync(cacheDir, { recursive: true });
  return cacheDir;
}

/** Track IDs are base62 from Spotify, but never trust a remote string with a path. */
function fileFor(trackId: string): string {
  return join(dir(), `${trackId.replace(/[^A-Za-z0-9_-]/g, '')}.json`);
}

export function get(trackId: string): Lyrics | null {
  const file = fileFor(trackId);
  if (!existsSync(file)) return null;

  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Lyrics;
    // Negative results expire; a track that was an instrumental last week may
    // simply not have been transcribed yet.
    if (parsed.syncLevel === 'none' && Date.now() - parsed.fetchedAt > NEGATIVE_TTL_MS) {
      unlinkSync(file);
      return null;
    }
    return parsed;
  } catch (error) {
    log.warn('unreadable cache entry, discarding', error);
    try {
      unlinkSync(file);
    } catch {
      // Already gone, or locked. Either way the read failed and we refetch.
    }
    return null;
  }
}

export function set(lyrics: Lyrics): void {
  try {
    writeFileSync(fileFor(lyrics.trackId), JSON.stringify(lyrics), 'utf8');
  } catch (error) {
    log.warn('could not write cache entry', error);
  }
}

/** Evict oldest-first down to the cap. Called once at startup, never in the hot path. */
export function evictOverflow(): void {
  try {
    const files = readdirSync(dir())
      .filter((name) => name.endsWith('.json'))
      .map((name) => {
        const path = join(dir(), name);
        return { path, mtime: statSync(path).mtimeMs };
      });

    if (files.length <= MAX_ENTRIES) return;

    files.sort((a, b) => a.mtime - b.mtime);
    for (const file of files.slice(0, files.length - MAX_ENTRIES)) {
      unlinkSync(file.path);
    }
    log.info(`evicted ${files.length - MAX_ENTRIES} cache entries`);
  } catch (error) {
    log.warn('cache eviction failed', error);
  }
}
