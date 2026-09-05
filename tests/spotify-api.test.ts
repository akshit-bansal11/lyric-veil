import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpotifyApiError, getPlayerState } from '../src/main/lib/spotify-api';

const PLAYING = {
  is_playing: true,
  progress_ms: 12_345,
  item: {
    id: '4cOdK2wGLETKBW3PvgPWqT',
    name: 'Never Gonna Give You Up',
    duration_ms: 213_000,
    artists: [{ name: 'Rick Astley' }],
    album: { name: 'Whenever You Need Somebody' },
  },
};

function respond(status: number, body?: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers });
}

describe('getPlayerState', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('parses a playing response', async () => {
    vi.mocked(fetch).mockResolvedValue(respond(200, PLAYING));
    const state = await getPlayerState('token');
    expect(state?.progress_ms).toBe(12_345);
    expect(state?.item?.artists[0]?.name).toBe('Rick Astley');
  });

  it('returns null for 204 rather than treating it as an error', async () => {
    vi.mocked(fetch).mockResolvedValue(respond(204));
    await expect(getPlayerState('token')).resolves.toBeNull();
  });

  it('raises an auth error on 401', async () => {
    vi.mocked(fetch).mockResolvedValue(respond(401, { error: 'expired' }));
    await expect(getPlayerState('token')).rejects.toMatchObject({ kind: 'auth' });
  });

  it('reads Retry-After on 429', async () => {
    vi.mocked(fetch).mockResolvedValue(respond(429, undefined, { 'retry-after': '5' }));
    await expect(getPlayerState('token')).rejects.toMatchObject({
      kind: 'rate-limit',
      retryAfterMs: 5000,
    });
  });

  it('falls back to a sane delay when 429 omits Retry-After', async () => {
    vi.mocked(fetch).mockResolvedValue(respond(429));
    await expect(getPlayerState('token')).rejects.toMatchObject({ retryAfterMs: 5000 });
  });

  it('rejects a response that does not match the schema', async () => {
    vi.mocked(fetch).mockResolvedValue(respond(200, { is_playing: 'yes' }));
    await expect(getPlayerState('token')).rejects.toMatchObject({ kind: 'schema' });
  });

  it('reports a network failure distinctly from an HTTP failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('offline'));
    const error = await getPlayerState('token').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SpotifyApiError);
    expect(error).toMatchObject({ kind: 'network' });
  });

  it('accepts a track with a null id, as podcasts and local files return', async () => {
    vi.mocked(fetch).mockResolvedValue(
      respond(200, { ...PLAYING, item: { ...PLAYING.item, id: null } }),
    );
    const state = await getPlayerState('token');
    expect(state?.item?.id).toBeNull();
  });
});
