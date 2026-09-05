import { cn } from '@renderer/lib/cn';
import type { AppConfig, TextAlign } from '@shared/config';

export interface SettingsPanelProps {
  config: AppConfig;
  className?: string;
}

const set = (patch: Partial<AppConfig>): void => window.lyricVeil.setConfig(patch);

const ALIGNMENTS: ReadonlyArray<{ value: TextAlign; label: string }> = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Right' },
];

const RANGE = 'w-28 accent-white';
const SWATCH = 'h-6 w-9 cursor-pointer rounded border border-white/20 bg-transparent p-0';

/** Just the file name; the full path is noise in a panel this small. */
function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/**
 * A labelled settings row. The visible text and the control are associated by
 * an explicit aria-label on each control rather than by wrapping them in a
 * label element, because several labels here carry a live value.
 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/60">{label}</span>
      {children}
    </div>
  );
}

/** Only rendered in interactive mode. */
export function SettingsPanel({ config, className }: SettingsPanelProps) {
  return (
    <div
      className={cn(
        'no-drag w-72 rounded-xl border border-white/15 bg-black/75 p-3 text-xs text-white backdrop-blur-md',
        className,
      )}
      style={{ textAlign: 'left', fontSize: '12px', textShadow: 'none' }}
    >
      <div className="flex flex-col gap-2.5">
        <Row label="Text colour">
          <input
            type="color"
            value={config.textColor}
            onChange={(e) => set({ textColor: e.target.value })}
            aria-label="Text colour"
            className={SWATCH}
          />
        </Row>

        <Row label={`Text opacity ${Math.round(config.textOpacity * 100)}%`}>
          <input
            type="range"
            min={0.15}
            max={1}
            step={0.05}
            value={config.textOpacity}
            onChange={(e) => set({ textOpacity: Number(e.target.value) })}
            aria-label="Opacity of words that are not being sung"
            className={RANGE}
          />
        </Row>

        <Row label={`Text size ${config.fontSizePx}px`}>
          <input
            type="range"
            min={20}
            max={72}
            step={1}
            value={config.fontSizePx}
            onChange={(e) => set({ fontSizePx: Number(e.target.value) })}
            aria-label="Text size in pixels"
            className={RANGE}
          />
        </Row>

        <Row label="Align">
          <fieldset className="m-0 flex overflow-hidden rounded border border-white/20 p-0">
            <legend className="sr-only">Text alignment</legend>
            {ALIGNMENTS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => set({ textAlign: option.value })}
                aria-pressed={config.textAlign === option.value}
                className={cn(
                  'px-2 py-0.5 transition-colors',
                  config.textAlign === option.value ? 'bg-white text-black' : 'hover:bg-white/10',
                )}
              >
                {option.label}
              </button>
            ))}
          </fieldset>
        </Row>

        <Row label={`Position X ${config.posX}%`}>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={config.posX}
            onChange={(e) => set({ posX: Number(e.target.value) })}
            aria-label="Horizontal position"
            className={RANGE}
          />
        </Row>

        <Row label={`Position Y ${config.posY}%`}>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={config.posY}
            onChange={(e) => set({ posY: Number(e.target.value) })}
            aria-label="Vertical position"
            className={RANGE}
          />
        </Row>

        <Row label="Background colour">
          <input
            type="color"
            value={config.bgColor}
            onChange={(e) => set({ bgColor: e.target.value })}
            aria-label="Background colour"
            className={SWATCH}
          />
        </Row>

        <Row label={`Background opacity ${Math.round(config.bgOpacity * 100)}%`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={config.bgOpacity}
            onChange={(e) => set({ bgOpacity: Number(e.target.value) })}
            aria-label="Background opacity"
            className={RANGE}
          />
        </Row>

        <Row label="Background image">
          <div className="flex items-center gap-1.5">
            {config.bgImagePath ? (
              <>
                <span className="max-w-24 truncate text-white/80" title={config.bgImagePath}>
                  {baseName(config.bgImagePath)}
                </span>
                <button
                  type="button"
                  onClick={() => window.lyricVeil.clearBackgroundImage()}
                  className="rounded border border-white/20 px-1.5 py-0.5 transition-colors hover:bg-white/10"
                >
                  Remove
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void window.lyricVeil.pickBackgroundImage()}
                className="rounded border border-white/20 px-2 py-0.5 transition-colors hover:bg-white/10"
              >
                Choose…
              </button>
            )}
          </div>
        </Row>

        <p className="m-0 pt-1 text-[10px] text-white/35 leading-tight">
          Ctrl+Alt+L closes this. Drag anywhere outside it to move the overlay.
        </p>
      </div>
    </div>
  );
}
