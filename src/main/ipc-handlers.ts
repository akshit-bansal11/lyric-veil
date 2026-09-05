import type { AppConfig } from '@shared/config';
import { IPC } from '@shared/ipc';
import { ipcMain } from 'electron';

export interface IpcActions {
  adjustOffset: (deltaMs: number) => void;
  setConfig: (patch: Partial<AppConfig>) => void;
  startAuth: () => void;
  quit: () => void;
}

/**
 * Renderer-to-main channels. Every payload is re-validated here rather than
 * trusted: the preload surface is narrow, but it is still a boundary.
 */
export function registerIpcHandlers(actions: IpcActions): void {
  ipcMain.on(IPC.ADJUST_OFFSET, (_event, deltaMs: unknown) => {
    if (typeof deltaMs === 'number' && Number.isFinite(deltaMs)) actions.adjustOffset(deltaMs);
  });

  ipcMain.on(IPC.SET_CONFIG, (_event, patch: unknown) => {
    if (patch && typeof patch === 'object' && !Array.isArray(patch)) {
      actions.setConfig(patch as Partial<AppConfig>);
    }
  });

  ipcMain.on(IPC.START_AUTH, () => actions.startAuth());
  ipcMain.on(IPC.QUIT, () => actions.quit());
}
