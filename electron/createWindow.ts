import path from 'node:path';
import { THEME_STUDIO_EVENT_CHANNELS } from '../src/shared/themeStudioContract';
import { historyCommandForInput } from './historyShortcut';

export type BrowserWindowLike = Pick<
  Electron.BrowserWindow,
  'loadURL' | 'loadFile' | 'once' | 'show'
> & {
  webContents: Pick<
    Electron.WebContents,
    'getURL' | 'setWindowOpenHandler' | 'on' | 'send'
  >;
};

export interface CreateWindowOptions {
  platform: NodeJS.Platform;
  developmentServerUrl?: string;
  applicationPath: string;
  preloadPath: string;
  makeWindow(
    options: Electron.BrowserWindowConstructorOptions,
  ): BrowserWindowLike;
}

function installWindowGuards(
  window: BrowserWindowLike,
  platform: NodeJS.Platform,
) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const command = historyCommandForInput(input, platform);
    if (!command) return;
    event.preventDefault();
    window.webContents.send(THEME_STUDIO_EVENT_CHANNELS.historyCommand, command);
  });
}

export async function createWindow(
  options: CreateWindowOptions,
): Promise<BrowserWindowLike> {
  const isMac = options.platform === 'darwin';
  const window = options.makeWindow({
    width: 1360,
    height: 880,
    minWidth: 1060,
    minHeight: 710,
    show: false,
    title: 'Bear KTBaker',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    vibrancy: isMac ? 'under-window' : undefined,
    visualEffectState: isMac ? 'active' : undefined,
    backgroundMaterial:
      options.platform === 'win32' ? 'acrylic' : 'none',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  installWindowGuards(window, options.platform);
  window.once('ready-to-show', () => window.show());
  if (options.developmentServerUrl) {
    await window.loadURL(options.developmentServerUrl);
  } else {
    await window.loadFile(
      path.join(options.applicationPath, 'dist', 'index.html'),
    );
  }
  return window;
}
