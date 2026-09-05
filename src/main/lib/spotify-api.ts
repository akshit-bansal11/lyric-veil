import { z } from 'zod';

const PLAYER_ENDPOINT = 'https://api.spotify.com/v1/me/player';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
export const AUTHORIZE_ENDPOINT = 'https://accounts.spotify.com/authorize';

const PlayerStateSchema = z.object({
  is_playing: z.boolean(),
  progress_ms: z.number().nullable(),
  item: z
    .object({
      id: z.string().nullable(),
      name: z.string(),
      duration_ms: z.number(),
      artists: z.array(z.object({ name: z.string() })),
      album: z.object({ name: z.string() }),
    })
    .nullable(),
});

export type PlayerState = z.infer<typeof PlayerStateSchema>;

const TokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
});

export type TokenResponse = z.infer<typeof TokenSchema>;

export type SpotifyErrorKind = 'auth' | 'rate-limit' | 'http' | 'network' | 'schema';

export class SpotifyApiError extends Error {
  readonly kind: SpotifyErrorKind;
  readonly status: number | undefined;
  readonly retryAfterMs: number | undefined;

  constructor(
    message: string,
    kind: SpotifyErrorKind,
    options: { status?: number; retryAfterMs?: number } = {},
  ) {
    super(message);
    this.name = 'SpotifyApiError';
    this.kind = kind;
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
  }
}

function retryAfterMs(response: Response): number {
  const header = response.headers.get('retry-after');
  const seconds = header ? Number.parseInt(header, 10) : Number.NaN;
  // Spotify omits the header often enough that a sane floor matters more than the spec.
  return Number.isFinite(seconds) ? Math.max(seconds, 1) * 1000 : 5000;
}

/**
 * Read the current playback state.
 *
 * Returns null for 204, which is Spotify's ordinary "nothing playing / no active
 * device" answer and not an error condition. Every other non-2xx throws so the
 * caller can distinguish an expired token from a rate limit from a dead network.
 */
export async function getPlayerState(token: string): Promise<PlayerState | null> {
  let response: Response;
  try {
    response = await fetch(PLAYER_ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new SpotifyApiError('player request failed', 'network', {});
  }

  if (response.status === 204) return null;
  if (response.status === 401) {
    throw new SpotifyApiError('access token rejected', 'auth', { status: 401 });
  }
  if (response.status === 429) {
    throw new SpotifyApiError('rate limited', 'rate-limit', {
      status: 429,
      retryAfterMs: retryAfterMs(response),
    });
  }
  if (!response.ok) {
    throw new SpotifyApiError(`player request returned ${response.status}`, 'http', {
      status: response.status,
    });
  }

  const parsed = PlayerStateSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new SpotifyApiError('player response did not match schema', 'schema', {});
  }
  return parsed.data;
}

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch {
    throw new SpotifyApiError('token request failed', 'network', {});
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    // invalid_grant means the refresh token is dead; only a fresh interactive login fixes it.
    const kind: SpotifyErrorKind =
      response.status === 400 && text.includes('invalid_grant') ? 'auth' : 'http';
    throw new SpotifyApiError(`token request returned ${response.status}`, kind, {
      status: response.status,
    });
  }

  const parsed = TokenSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new SpotifyApiError('token response did not match schema', 'schema', {});
  }
  return parsed.data;
}

export function exchangeCode(args: {
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  return postToken(
    new URLSearchParams({
      client_id: args.clientId,
      grant_type: 'authorization_code',
      code: args.code,
      redirect_uri: args.redirectUri,
      code_verifier: args.codeVerifier,
    }),
  );
}

export function refreshAccessToken(args: {
  clientId: string;
  refreshToken: string;
}): Promise<TokenResponse> {
  return postToken(
    new URLSearchParams({
      client_id: args.clientId,
      grant_type: 'refresh_token',
      refresh_token: args.refreshToken,
    }),
  );
}
