import { type AppConfig, DEFAULT_CONFIG } from '@shared/config';
import Store from 'electron-store';

export interface StoredTokens {
  refreshToken: string;
  accessToken: string;
  /** Epoch ms at which the access token stops being valid. */
  expiresAt: number;
}

const configStore = new Store<{ config: AppConfig }>({
  name: 'config',
  defaults: { config: DEFAULT_CONFIG },
});

/**
 * The encryption key is compiled into the binary, so this is obfuscation rather
 * than security: it keeps a refresh token out of a plaintext file that gets
 * screen-shared or synced, and nothing more. The token is scoped to read-only
 * playback state, which is what makes that trade acceptable.
 */
const tokenStore = new Store<{ tokens: StoredTokens | null }>({
  name: 'tokens',
  encryptionKey: 'lyric-veil-local-obfuscation',
  defaults: { tokens: null },
});

export function readConfig(): AppConfig {
  // Merge over defaults so a config written by an older version stays loadable.
  return { ...DEFAULT_CONFIG, ...configStore.get('config') };
}

export function writeConfig(patch: Partial<AppConfig>): AppConfig {
  const next: AppConfig = { ...readConfig(), ...patch };
  configStore.set('config', next);
  return next;
}

export function readTokens(): StoredTokens | null {
  return tokenStore.get('tokens');
}

export function writeTokens(tokens: StoredTokens | null): void {
  tokenStore.set('tokens', tokens);
}
