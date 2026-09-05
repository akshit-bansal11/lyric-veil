import { cn } from '@renderer/lib/cn';
import type { AppConfig } from '@shared/config';
import { OFFSET_MAX_MS, OFFSET_MIN_MS } from '@shared/config';

export interface SettingsPanelProps {
  config: AppConfig;
  className?: string;
}

const set = (patch: Partial<AppConfig>): void => window.lyricVeil.setConfig(patch);

/**
 * A labelled settings row. The visible text and the control are associated by
 * an explicit aria-label on each control rather than by wrapping them in a
 * `<label>`: the label text here is dynamic ("Offset +150 ms"), so the accessible
 * name has to carry the value, not just the field name.
 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/60">{label}</span>
      {children}
    </div>
  );
}

/**
 * Only rendered in interactive mode. Everything here is also reachable from the
 * tray or a hotkey -- this panel exists so the settings are discoverable, not
 * because it is the only way in.
 */
export function SettingsPanel({ config, className }: SettingsPanelProps) {
  return (
    <div
      className={cn(
        'no-drag w-64 rounded-xl border border-white/15 bg-black/70 p-3 text-xs text-white backdrop-blur-md',
        className,
      )}
    >
      <div className="flex flex-col gap-2.5">
        <Row label={`Offset ${config.offsetMs > 0 ? '+' : ''}${config.offsetMs} ms`}>
          <input
            type="range"
            min={OFFSET_MIN_MS}
            max={OFFSET_MAX_MS}
            step={50}
            value={config.offsetMs}
            onChange={(e) => set({ offsetMs: Number(e.target.value) })}
            aria-label="Sync offset in milliseconds"
            className="w-28 accent-white"
          />
        </Row>

        <Row label={`Size ${config.fontSizePx}px`}>
          <input
            type="range"
            min={20}
            max={72}
            step={1}
            value={config.fontSizePx}
            onChange={(e) => set({ fontSizePx: Number(e.target.value) })}
            aria-label="Font size in pixels"
            className="w-28 accent-white"
          />
        </Row>

        <Row label="Align">
          <select
            value={config.textAlign}
            onChange={(e) => set({ textAlign: e.target.value === 'center' ? 'center' : 'left' })}
            aria-label="Text alignment"
            className="rounded border border-white/20 bg-black/60 px-1.5 py-0.5"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
          </select>
        </Row>

        <Row label="Dim backdrop">
          <input
            type="checkbox"
            checked={config.showBackdrop}
            onChange={(e) => set({ showBackdrop: e.target.checked })}
            aria-label="Dim backdrop behind the lyrics"
            className="accent-white"
          />
        </Row>

        <Row label="Hide in fullscreen">
          <input
            type="checkbox"
            checked={config.hideOnFullscreen}
            onChange={(e) => set({ hideOnFullscreen: e.target.checked })}
            aria-label="Hide the overlay in fullscreen apps"
            className="accent-white"
          />
        </Row>

        <Row label="Launch at login">
          <input
            type="checkbox"
            checked={config.launchOnStartup}
            onChange={(e) => set({ launchOnStartup: e.target.checked })}
            aria-label="Launch Lyric Veil at login"
            className="accent-white"
          />
        </Row>

        <div className="mt-1 flex gap-2 border-white/10 border-t pt-2">
          <button
            type="button"
            onClick={() => window.lyricVeil.startAuth()}
            className="rounded border border-white/20 px-2 py-1 transition-colors hover:bg-white/10"
          >
            Reconnect
          </button>
          <button
            type="button"
            onClick={() => window.lyricVeil.quit()}
            className="rounded border border-white/20 px-2 py-1 transition-colors hover:bg-white/10"
          >
            Quit
          </button>
        </div>

        <p className="m-0 text-[10px] text-white/40 leading-tight">
          Ctrl+Alt+L exits interactive mode. Ctrl+Alt+[ and ] nudge the offset.
        </p>
      </div>
    </div>
  );
}
