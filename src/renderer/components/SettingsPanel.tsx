import { cn } from '@renderer/lib/cn';
import {
  type AppConfig,
  DEFAULT_CONFIG,
  type HighlightMode,
  OFFSET_MAX_MS,
  OFFSET_MIN_MS,
  type TextAlign,
} from '@shared/config';

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

const HIGHLIGHTS: ReadonlyArray<{ value: HighlightMode; label: string }> = [
  { value: 'word', label: 'Word' },
  { value: 'line', label: 'Line' },
];

/** Faces that ship with Windows 10/11. Anything installed can still be typed in. */
const FONT_SUGGESTIONS = [
  'Segoe UI Variable Display',
  'Segoe UI',
  'Bahnschrift',
  'Arial',
  'Calibri',
  'Cambria',
  'Georgia',
  'Impact',
  'Tahoma',
  'Trebuchet MS',
  'Verdana',
  'Times New Roman',
  'Consolas',
  'Inter',
];

const RANGE = 'w-28 accent-white';
const SWATCH = 'h-6 w-9 cursor-pointer rounded border border-white/20 bg-transparent p-0';
const BUTTON = 'rounded border border-white/20 px-2 py-0.5 transition-colors hover:bg-white/10';

/** Just the file name; the full path is noise in a panel this small. */
function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/**
 * A labelled settings row. The visible text and the control are associated by
 * an explicit aria-label on each control rather than by wrapping them in a
 * label element, because most labels here carry a live value.
 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/60">{label}</span>
      {children}
    </div>
  );
}

interface RangeProps {
  label: string;
  aria: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** How the live value reads in the label. */
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

function Range({ label, aria, value, min, max, step, format, onChange }: RangeProps) {
  return (
    <Row label={`${label} ${format ? format(value) : String(value)}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={aria}
        className={RANGE}
      />
    </Row>
  );
}

function Section({ title }: { title: string }) {
  return <p className="m-0 mt-1.5 text-[10px] text-white/35 uppercase tracking-wider">{title}</p>;
}

const percent = (v: number): string => `${Math.round(v * 100)}%`;
const signedMs = (v: number): string => `${v > 0 ? '+' : ''}${v} ms`;

/** Only rendered in interactive mode. */
export function SettingsPanel({ config, className }: SettingsPanelProps) {
  return (
    <div
      className={cn(
        'no-drag max-h-[calc(100%-1.5rem)] w-72 overflow-y-auto rounded-xl border border-white/15 bg-black/80 p-3 text-xs text-white backdrop-blur-md',
        className,
      )}
      style={{
        textAlign: 'left',
        fontSize: '12px',
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: 0,
        textShadow: 'none',
      }}
    >
      <div className="flex flex-col gap-2">
        <Section title="Text" />

        <Row label="Font">
          <input
            type="text"
            list="lyric-veil-fonts"
            value={config.fontFamily}
            onChange={(e) => set({ fontFamily: e.target.value })}
            aria-label="Font family"
            spellCheck={false}
            className="w-36 rounded border border-white/20 bg-black/60 px-1.5 py-0.5"
          />
          <datalist id="lyric-veil-fonts">
            {FONT_SUGGESTIONS.map((font) => (
              <option key={font} value={font} />
            ))}
          </datalist>
        </Row>

        <Row label="Colour">
          <input
            type="color"
            value={config.textColor}
            onChange={(e) => set({ textColor: e.target.value })}
            aria-label="Text colour"
            className={SWATCH}
          />
        </Row>

        <Range
          label="Opacity"
          aria="Opacity of words that are not being sung"
          value={config.textOpacity}
          min={0.15}
          max={1}
          step={0.05}
          format={percent}
          onChange={(v) => set({ textOpacity: v })}
        />
        <Range
          label="Size"
          aria="Text size in pixels"
          value={config.fontSizePx}
          min={20}
          max={72}
          step={1}
          format={(v) => `${v}px`}
          onChange={(v) => set({ fontSizePx: v })}
        />
        <Range
          label="Weight"
          aria="Font weight"
          value={config.fontWeight}
          min={300}
          max={900}
          step={100}
          onChange={(v) => set({ fontWeight: v })}
        />
        <Range
          label="Line height"
          aria="Line height"
          value={config.lineHeight}
          min={1}
          max={1.8}
          step={0.02}
          format={(v) => v.toFixed(2)}
          onChange={(v) => set({ lineHeight: v })}
        />
        <Range
          label="Letter spacing"
          aria="Letter spacing in em"
          value={config.letterSpacingEm}
          min={-0.06}
          max={0.12}
          step={0.005}
          format={(v) => `${v.toFixed(3)}em`}
          onChange={(v) => set({ letterSpacingEm: v })}
        />

        <Row label="Shadow">
          <input
            type="checkbox"
            checked={config.textShadow}
            onChange={(e) => set({ textShadow: e.target.checked })}
            aria-label="Text shadow"
            className="accent-white"
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

        <Section title="Layout" />

        <Range
          label="Position X"
          aria="Horizontal position"
          value={config.posX}
          min={0}
          max={100}
          step={1}
          format={(v) => `${v}%`}
          onChange={(v) => set({ posX: v })}
        />
        <Range
          label="Position Y"
          aria="Vertical position"
          value={config.posY}
          min={0}
          max={100}
          step={1}
          format={(v) => `${v}%`}
          onChange={(v) => set({ posY: v })}
        />
        <Range
          label="Width"
          aria="Window width in pixels"
          value={config.width}
          min={400}
          max={1600}
          step={10}
          format={(v) => `${v}px`}
          onChange={(v) => set({ width: v })}
        />
        <Range
          label="Height"
          aria="Window height in pixels"
          value={config.height}
          min={200}
          max={900}
          step={10}
          format={(v) => `${v}px`}
          onChange={(v) => set({ height: v })}
        />
        <Range
          label="Lines above"
          aria="Lines shown above the current one"
          value={config.linesAbove}
          min={0}
          max={4}
          step={1}
          onChange={(v) => set({ linesAbove: v })}
        />
        <Range
          label="Lines below"
          aria="Lines shown below the current one"
          value={config.linesBelow}
          min={0}
          max={8}
          step={1}
          onChange={(v) => set({ linesBelow: v })}
        />
        <Row label="Stay above other windows">
          <input
            type="checkbox"
            checked={config.alwaysOnTop}
            onChange={(e) => set({ alwaysOnTop: e.target.checked })}
            aria-label="Keep the overlay above every other window"
            className="accent-white"
          />
        </Row>
        {config.alwaysOnTop ? null : (
          <p className="m-0 text-[10px] text-white/35 leading-tight">
            Off: it sits on the desktop and any window you use covers it. Ctrl+Alt+H twice brings it
            back to the front.
          </p>
        )}

        <Section title="Background" />

        <Row label="Colour">
          <input
            type="color"
            value={config.bgColor}
            onChange={(e) => set({ bgColor: e.target.value })}
            aria-label="Background colour"
            className={SWATCH}
          />
        </Row>
        <Range
          label="Opacity"
          aria="Background opacity"
          value={config.bgOpacity}
          min={0}
          max={1}
          step={0.05}
          format={percent}
          onChange={(v) => set({ bgOpacity: v })}
        />
        <Row label="Image">
          <div className="flex items-center gap-1.5">
            {config.bgImagePath ? (
              <>
                <span className="max-w-24 truncate text-white/80" title={config.bgImagePath}>
                  {baseName(config.bgImagePath)}
                </span>
                <button
                  type="button"
                  onClick={() => window.lyricVeil.clearBackgroundImage()}
                  className={BUTTON}
                >
                  Remove
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void window.lyricVeil.pickBackgroundImage()}
                className={BUTTON}
              >
                Choose…
              </button>
            )}
          </div>
        </Row>

        <Section title="Timing" />

        <Row label="Highlight">
          <fieldset className="m-0 flex overflow-hidden rounded border border-white/20 p-0">
            <legend className="sr-only">Highlight mode</legend>
            {HIGHLIGHTS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => set({ highlightMode: option.value })}
                aria-pressed={config.highlightMode === option.value}
                className={cn(
                  'px-2 py-0.5 transition-colors',
                  config.highlightMode === option.value
                    ? 'bg-white text-black'
                    : 'hover:bg-white/10',
                )}
              >
                {option.label}
              </button>
            ))}
          </fieldset>
        </Row>
        {config.highlightMode === 'word' ? (
          <p className="m-0 text-[10px] text-white/35 leading-tight">
            Word timing is estimated; the source only knows when each line starts. Switch to Line if
            words land off.
          </p>
        ) : null}

        <Range
          label="Sync offset"
          aria="Sync offset in milliseconds; positive shows lyrics earlier"
          value={config.offsetMs}
          min={OFFSET_MIN_MS}
          max={OFFSET_MAX_MS}
          step={25}
          format={signedMs}
          onChange={(v) => set({ offsetMs: v })}
        />
        <p className="m-0 text-[10px] text-white/35 leading-tight">
          Lyrics late? Drag right. Early? Drag left. Ctrl+Alt+[ and ] do the same in 100 ms steps.
        </p>

        <div className="mt-1 flex items-center justify-between border-white/10 border-t pt-2">
          <button type="button" onClick={() => set(DEFAULT_CONFIG)} className={BUTTON}>
            Reset to defaults
          </button>
          <span className="text-[10px] text-white/35">Ctrl+Alt+L closes this</span>
        </div>
      </div>
    </div>
  );
}
