import { join } from 'node:path';
import type { AppConfig } from '@shared/config';
import { Menu, Tray, app, nativeImage } from 'electron';

export interface TrayActions {
  isVisible: () => boolean;
  toggleVisible: () => void;
  isInteractive: () => boolean;
  toggleInteractive: () => void;
  getConfig: () => AppConfig;
  setConfig: (patch: Partial<AppConfig>) => void;
  resetOffset: () => void;
  reconnect: () => void;
  openLogs: () => void;
  quit: () => void;
}

function iconPath(): string {
  // resources/ is packed inside app.asar, not beside it, and Electron reads
  // asar paths transparently -- so the app path works packaged and in dev alike.
  // Looking beside the asar (process.resourcesPath) found nothing in the
  // installed build and left the tray with an empty icon.
  return join(app.getAppPath(), 'resources', 'tray.png');
}

export function createTray(actions: TrayActions): Tray {
  const image = nativeImage.createFromPath(iconPath());
  const tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('Lyric Veil');

  const render = (): void => {
    const config = actions.getConfig();
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: actions.isVisible() ? 'Hide overlay' : 'Show overlay',
          accelerator: 'Ctrl+Alt+H',
          click: () => {
            actions.toggleVisible();
            render();
          },
        },
        {
          label: 'Interactive mode',
          type: 'checkbox',
          checked: actions.isInteractive(),
          accelerator: 'Ctrl+Alt+L',
          click: () => {
            actions.toggleInteractive();
            render();
          },
        },
        { type: 'separator' },
        {
          label: 'Hide in fullscreen apps',
          type: 'checkbox',
          checked: config.hideOnFullscreen,
          click: () => {
            actions.setConfig({ hideOnFullscreen: !config.hideOnFullscreen });
            render();
          },
        },
        {
          label: 'Launch at login',
          type: 'checkbox',
          checked: config.launchOnStartup,
          click: () => {
            actions.setConfig({ launchOnStartup: !config.launchOnStartup });
            render();
          },
        },
        { type: 'separator' },
        { label: 'Reset sync offset', accelerator: 'Ctrl+Alt+0', click: actions.resetOffset },
        { label: 'Reconnect Spotify', click: actions.reconnect },
        { label: 'Open logs folder', click: actions.openLogs },
        { type: 'separator' },
        { label: `Lyric Veil ${app.getVersion()}`, enabled: false },
        { label: 'Quit', click: actions.quit },
      ]),
    );
  };

  render();
  // Rebuild on open so the checkboxes and the show/hide label are never stale.
  tray.on('click', render);
  return tray;
}
