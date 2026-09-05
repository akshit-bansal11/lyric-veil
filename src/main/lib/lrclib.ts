import { z } from 'zod';

const BASE = 'https://lrclib.net/api';
const USER_AGENT = 'LyricVeil/0.1.0 (https://github.com/akshit-bansal11/lyric-veil)';

const RecordSchema = z.object({
  id: z.number(),
  trackName: z.string(),
  artistName: z.string(),
  duration: z.number().nullable(),
  instrumental: z.boolean(),
  plainLyrics: z.string().nullable(),
  syncedLyrics: z.string().nullable(),
});

export type LrclibRecord = z.infer<typeof RecordSchema>;

export interface LrclibQuery {
  title: string;
  artist: string;
  album: string;
  durationMs: number;
}

async function getJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    // 404 is LRCLIB's ordinary "no match", not a failure worth logging as one.
    if (response.status === 404) return null;
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Exact lookup. LRCLIB matches on title, artist, album and duration together, so
 * passing the duration is what keeps a remaster from resolving to the original's
 * timings -- same words, several seconds out.
 */
async function getExact(query: LrclibQuery): Promise<LrclibRecord | null> {
  const params = new URLSearchParams({
    track_name: query.title,
    artist_name: query.artist,
    album_name: query.album,
    duration: String(Math.round(query.durationMs / 1000)),
  });
  const parsed = RecordSchema.safeParse(await getJson(`${BASE}/get?${params}`));
  return parsed.success ? parsed.data : null;
}

/** Looser search, used only when the exact lookup misses. */
async function search(query: LrclibQuery): Promise<LrclibRecord | null> {
  const params = new URLSearchParams({
    track_name: query.title,
    artist_name: query.artist,
  });
  const parsed = z.array(RecordSchema).safeParse(await getJson(`${BASE}/search?${params}`));
  if (!parsed.success || parsed.data.length === 0) return null;

  const wantedSeconds = query.durationMs / 1000;
  const synced = parsed.data.filter((r) => r.syncedLyrics);
  const pool = synced.length > 0 ? synced : parsed.data;

  // Closest duration wins; a five-minute live cut is not the three-minute single.
  return pool.reduce((best, candidate) => {
    const delta = (r: LrclibRecord) => Math.abs((r.duration ?? 0) - wantedSeconds);
    return delta(candidate) < delta(best) ? candidate : best;
  });
}

/**
 * Strip the decorations Spotify puts in titles that lyric databases do not carry:
 * `(Remastered 2011)`, `- Radio Edit`, `(feat. X)`, `(Live)`. This materially
 * improves the hit rate and costs one regex.
 */
export function cleanTitle(title: string): string {
  return (
    title
      .replace(
        /\s*[([][^)\]]*(?:remaster|remix|version|edit|live|feat\.?|with|mono|stereo)[^)\]]*[)\]]/gi,
        '',
      )
      // The keyword is often not adjacent to the dash: 'Song - 2019 Remaster'.
      .replace(
        /\s*-\s*(?:[^-]*\b)?(?:remaster(?:ed)?|remix|version|edit|live|mono|stereo|mix)\b.*$/i,
        '',
      )
      .replace(/\s{2,}/g, ' ')
      .trim()
  );
}

/** First artist only -- LRCLIB indexes the primary credit, not the full billing. */
export function primaryArtist(artist: string): string {
  return (artist.split(/,|&|\bfeat\.?\b|\bwith\b/i)[0] ?? artist).trim();
}

/**
 * Fetch the best available record, trying the raw title first and the cleaned
 * title second. Returns null when nothing matched.
 */
export async function fetchLyricRecord(query: LrclibQuery): Promise<LrclibRecord | null> {
  const cleaned: LrclibQuery = {
    ...query,
    title: cleanTitle(query.title),
    artist: primaryArtist(query.artist),
  };

  const attempts: LrclibQuery[] =
    cleaned.title === query.title && cleaned.artist === query.artist ? [query] : [query, cleaned];

  for (const attempt of attempts) {
    const exact = await getExact(attempt);
    if (exact) return exact;
  }
  return search(cleaned);
}
