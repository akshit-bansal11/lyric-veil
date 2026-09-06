import { useConfig } from '@renderer/hooks/useLyrics';
import { SettingsPanel } from './components/SettingsPanel';

/**
 * Root for the settings window. The same panel the overlay used to draw over
 * the lyrics, now filling a window of its own. Nothing else runs here -- no
 * clock, no lyrics -- so the panel costs nothing while it is closed.
 */
export function SettingsApp() {
  const config = useConfig();
  return (
    <div className="h-full w-full bg-[#0b0b0c] text-white">
      <SettingsPanel
        config={config}
        className="h-full max-h-none w-full rounded-none border-0 bg-transparent backdrop-blur-none"
      />
    </div>
  );
}
