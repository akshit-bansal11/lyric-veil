export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppConfig {
  offsetMs: number;
  fontSizePx: number;
  fontFamily: string;
  activeOpacity: number;
  inactiveOpacity: number;
  textAlign: 'left' | 'center';
  showBackdrop: boolean;
  hideOnFullscreen: boolean;
  linesAbove: number;
  linesBelow: number;
  bounds: WindowBounds | null;
  launchOnStartup: boolean;
}

export const OFFSET_MIN_MS = -3000;
export const OFFSET_MAX_MS = 3000;

export const DEFAULT_CONFIG: AppConfig = {
  offsetMs: 0,
  fontSizePx: 36,
  fontFamily: 'Inter',
  activeOpacity: 1,
  inactiveOpacity: 0.3,
  textAlign: 'left',
  showBackdrop: false,
  hideOnFullscreen: true,
  linesAbove: 2,
  linesBelow: 6,
  bounds: null,
  launchOnStartup: false,
};

export function clampOffset(ms: number): number {
  return Math.min(Math.max(Math.round(ms), OFFSET_MIN_MS), OFFSET_MAX_MS);
}
