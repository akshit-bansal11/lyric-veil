import { globalShortcut } from 'electron';
import { createLogger } from './lib/logger';

const log = createLogger('hotkeys');

export const OFFSET_STEP_MS = 100;

export interface HotkeyActions {
  toggleInteractive: () => void;
  toggleVisible: () => void;
  adjustOffset: (deltaMs: number) => void;
  resetOffset: () => void;
}

/**
 * Register the global hotkeys. A combination already claimed by another app
 * fails silently in Electron, so each failure is logged rather than thrown --
 * one unavailable binding should not cost the other four.
 */
export function registerHotkeys(actions: HotkeyActions): void {
  const bindings: ReadonlyArray<readonly [string, () => void]> = [
    ['Control+Alt+L', actions.toggleInteractive],
    ['Control+Alt+H', actions.toggleVisible],
    ['Control+Alt+[', () => actions.adjustOffset(-OFFSET_STEP_MS)],
    ['Control+Alt+]', () => actions.adjustOffset(OFFSET_STEP_MS)],
    ['Control+Alt+0', actions.resetOffset],
  ];

  for (const [accelerator, handler] of bindings) {
    if (!globalShortcut.register(accelerator, handler)) {
      log.warn(`could not register ${accelerator}; another app likely owns it`);
    }
  }
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll();
}
