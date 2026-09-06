import { type AppConfig, DEFAULT_CONFIG } from '@shared/config';
import { IPC } from '@shared/ipc';
import { ipcMain } from 'electron';

export interface IpcActions {
  adjustOffset: (deltaMs: number) => void;
  setConfig: (patch: Partial<AppConfig>) => void;
  pickBackgroundImage: () => Promise<boolean>;
  clearBackgroundImage: () => void;
  copyRedirectUri: () => void;
  openDashboard: () => void;
  startAuth: () => void;
  quit: () => void;
}

/**
 * Keep only known keys whose value has the type the default has. The renderer
 * is our own code behind context isolation, but this is still a boundary, and
 * a config write is the one place it can reach the persisted store.
 *
 * bgImagePath is excluded on purpose: the renderer never names a file. It asks
 * main to open a picker, and main decides what gets read.
 */
function sanitizeConfigPatch(input: unknown): Partial<AppConfig> {
  const patch: Partial<AppConfig> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return patch;
  const candidate = input as Record<string, unknown>;

  for (const key of Object.keys(DEFAULT_CONFIG) as Array<keyof AppConfig>) {
    if (key === 'bgImagePath' || !(key in candidate)) continue;
    const value = candidate[key];
    if (typeof value === typeof DEFAULT_CONFIG[key]) {
      (patch as Record<keyof AppConfig, unknown>)[key] = value;
    }
  }
  return patch;
}

/** Renderer-to-main channels. Every payload is re-validated here rather than trusted. */
export function registerIpcHandlers(actions: IpcActions): void {
  ipcMain.on(IPC.ADJUST_OFFSET, (_event, deltaMs: unknown) => {
    if (typeof deltaMs === 'number' && Number.isFinite(deltaMs)) actions.adjustOffset(deltaMs);
  });

  ipcMain.on(IPC.SET_CONFIG, (_event, patch: unknown) => {
    const clean = sanitizeConfigPatch(patch);
    if (Object.keys(clean).length > 0) actions.setConfig(clean);
  });

  ipcMain.handle(IPC.PICK_BG_IMAGE, () => actions.pickBackgroundImage());
  ipcMain.on(IPC.CLEAR_BG_IMAGE, () => actions.clearBackgroundImage());
  // Both take no argument on purpose: the URI and the URL are fixed constants,
  // so the renderer can never ask main to copy or open something of its choosing.
  ipcMain.on(IPC.COPY_REDIRECT_URI, () => actions.copyRedirectUri());
  ipcMain.on(IPC.OPEN_DASHBOARD, () => actions.openDashboard());
  ipcMain.on(IPC.START_AUTH, () => actions.startAuth());
  ipcMain.on(IPC.QUIT, () => actions.quit());
}
