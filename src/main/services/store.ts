import { type AppConfig, DEFAULT_CONFIG } from '@shared/config';
import Store from 'electron-store';

export interface StoredTokens {
  refreshToken: string;
  accessToken: string;
  /** Epoch ms at which the access token stops being valid. */
  expiresAt: number;
}

const configStore = new Store<{ config: Partial<AppConfig> }>({
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

/**
 * Only keys the current version knows are read back. A config written by an
 * older build keeps loading, and keys that version has since dropped do not
 * linger as untyped baggage on every object that passes through.
 */
export function readConfig(): AppConfig {
  const stored = configStore.get('config');
  const merged = { ...DEFAULT_CONFIG };
  for (const key of Object.keys(DEFAULT_CONFIG) as Array<keyof AppConfig>) {
    const value = stored[key];
    if (value === undefined) continue;
    // bgImagePath is the one nullable field; its default is null, so a typeof
    // comparison against the default would reject every real path.
    const accepted =
      key === 'bgImagePath'
        ? value === null || typeof value === 'string'
        : typeof value === typeof DEFAULT_CONFIG[key];
    if (accepted) (merged as Record<keyof AppConfig, unknown>)[key] = value;
  }
  return merged;
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
