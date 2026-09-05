/// <reference types="vite/client" />

import type { LyricVeilBridge } from '@shared/ipc';

declare global {
  interface Window {
    lyricVeil: LyricVeilBridge;
  }
}
