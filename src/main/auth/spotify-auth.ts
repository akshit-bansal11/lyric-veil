import { type Server, createServer } from 'node:http';
import { SPOTIFY_REDIRECT_PORT, SPOTIFY_REDIRECT_URI } from '@shared/config';
import { shell } from 'electron';
import { createLogger } from '../lib/logger';
import {
  AUTHORIZE_ENDPOINT,
  SpotifyApiError,
  exchangeCode,
  refreshAccessToken,
} from '../lib/spotify-api';
import { readTokens, writeTokens } from '../services/store';
import { createPkcePair, createState } from './pkce';

const log = createLogger('auth');

const REDIRECT_PORT = SPOTIFY_REDIRECT_PORT;
export const REDIRECT_URI = SPOTIFY_REDIRECT_URI;
const SCOPES = 'user-read-playback-state user-read-currently-playing';
/** Refresh this far ahead of expiry so a request never races the deadline. */
const REFRESH_MARGIN_MS = 60_000;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

const CLOSE_PAGE = [
  '<!doctype html><meta charset="utf-8"><title>Lyric Veil</title>',
  '<style>body{font:16px system-ui;display:grid;place-items:center;',
  'height:100vh;margin:0;background:#111;color:#eee}</style>',
  '<p>Connected. You can close this tab.</p>',
].join('');

export class AuthError extends Error {}

/** The client ID in use. Null means the user has not provided one yet. */
let clientId: string | null = null;

/** Returns true when the value actually changed, so the caller can re-authenticate. */
export function configureClientId(id: string | undefined): boolean {
  const next = id && id.trim().length > 0 ? id.trim() : null;
  if (next === clientId) return false;
  clientId = next;
  return true;
}

export function getClientId(): string | null {
  return clientId;
}

export function isConfigured(): boolean {
  return clientId !== null;
}

export function isAuthenticated(): boolean {
  return readTokens() !== null;
}

function requireClientId(): string {
  if (!clientId) {
    throw new AuthError('MAIN_VITE_SPOTIFY_CLIENT_ID is not set');
  }
  return clientId;
}

/** In-flight refresh, memoized so two callers never trigger two refreshes. */
let refreshInFlight: Promise<string> | null = null;
/** In-flight interactive login, memoized for the same reason. */
let loginInFlight: Promise<void> | null = null;

async function doRefresh(refreshToken: string): Promise<string> {
  const id = requireClientId();
  try {
    const token = await refreshAccessToken({ clientId: id, refreshToken });
    writeTokens({
      // Spotify only sometimes rotates the refresh token; keep the old one when it does not.
      refreshToken: token.refresh_token ?? refreshToken,
      accessToken: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    });
    return token.access_token;
  } catch (error) {
    if (error instanceof SpotifyApiError && error.kind === 'auth') {
      log.warn('refresh token rejected, clearing stored credentials');
      writeTokens(null);
      throw new AuthError('refresh token rejected');
    }
    throw error;
  }
}

function startRefresh(refreshToken: string): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh(refreshToken).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * Return a usable access token, refreshing when it is close to expiry.
 * Throws AuthError when the user has to log in again.
 */
export async function getAccessToken(): Promise<string> {
  const tokens = readTokens();
  if (!tokens) throw new AuthError('not authenticated');
  if (tokens.expiresAt - Date.now() > REFRESH_MARGIN_MS) return tokens.accessToken;
  return startRefresh(tokens.refreshToken);
}

/** Force a refresh regardless of the recorded expiry, after a 401. */
export function forceRefresh(): Promise<string> {
  const tokens = readTokens();
  if (!tokens) return Promise.reject(new AuthError('not authenticated'));
  return startRefresh(tokens.refreshToken);
}

function waitForCallback(expectedState: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const server: Server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', REDIRECT_URI);
      if (url.pathname !== '/callback') {
        res.writeHead(404).end();
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(CLOSE_PAGE);
      clearTimeout(timeout);
      server.close();

      // Validate state before touching the code, so a stray request cannot drive a login.
      if (state !== expectedState) reject(new AuthError('state mismatch'));
      else if (!code) reject(new AuthError(url.searchParams.get('error') ?? 'no code returned'));
      else resolve(code);
    });

    const timeout = setTimeout(() => {
      server.close();
      reject(new AuthError('login timed out'));
    }, LOGIN_TIMEOUT_MS);

    server.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    server.listen(REDIRECT_PORT, '127.0.0.1');
  });
}

async function runInteractiveLogin(): Promise<void> {
  const id = requireClientId();
  const { verifier, challenge } = createPkcePair();
  const state = createState();

  const authorizeUrl = new URL(AUTHORIZE_ENDPOINT);
  authorizeUrl.search = new URLSearchParams({
    client_id: id,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  }).toString();

  const pending = waitForCallback(state);
  // The system browser, not a BrowserWindow: embedded webviews are increasingly
  // refused by identity providers, and the user's existing session lives here.
  await shell.openExternal(authorizeUrl.toString());

  const code = await pending;
  const token = await exchangeCode({
    clientId: id,
    code,
    redirectUri: REDIRECT_URI,
    codeVerifier: verifier,
  });

  if (!token.refresh_token) throw new AuthError('no refresh token returned');
  writeTokens({
    refreshToken: token.refresh_token,
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  });
  log.info('interactive login completed');
}

/** Refresh silently when possible, otherwise run the interactive flow. */
export async function ensureAuthenticated(): Promise<void> {
  requireClientId();

  if (readTokens()) {
    try {
      await getAccessToken();
      return;
    } catch (error) {
      if (!(error instanceof AuthError)) throw error;
    }
  }

  if (!loginInFlight) {
    loginInFlight = runInteractiveLogin().finally(() => {
      loginInFlight = null;
    });
  }
  return loginInFlight;
}

export function signOut(): void {
  writeTokens(null);
}
