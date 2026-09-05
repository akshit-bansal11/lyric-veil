import { join } from 'node:path';
import { Menu, Tray, app, nativeImage } from 'electron';

export interface TrayActions {
  isVisible: () => boolean;
  toggleVisible: () => void;
  isInteractive: () => boolean;
  toggleInteractive: () => void;
  resetOffset: () => void;
  reconnect: () => void;
  openLogs: () => void;
  quit: () => void;
}

function iconPath(): string {
  // Packaged, resources/ sits beside the asar; in dev it is next to the sources.
  return app.isPackaged
    ? join(process.resourcesPath, 'resources', 'tray.png')
    : join(app.getAppPath(), 'resources', 'tray.png');
}

export function createTray(actions: TrayActions): Tray {
  const image = nativeImage.createFromPath(iconPath());
  const tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('Lyric Veil');

  const render = (): void => {
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
  // Rebuild on open so the checkbox and the show/hide label are never stale.
  tray.on('click', render);
  return tray;
}
