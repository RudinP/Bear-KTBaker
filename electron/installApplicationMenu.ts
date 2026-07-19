import { createApplicationMenuTemplate } from './applicationMenu';

export interface InstallApplicationMenuDependencies {
  platform: NodeJS.Platform;
  buildFromTemplate:
    typeof import('electron').Menu.buildFromTemplate;
  setApplicationMenu:
    typeof import('electron').Menu.setApplicationMenu;
  focusedWindow:
    typeof import('electron').BrowserWindow.getFocusedWindow;
}

export function installApplicationMenu(
  dependencies: InstallApplicationMenuDependencies,
): void {
  const template = createApplicationMenuTemplate(
    dependencies.platform,
    (command) => {
      dependencies.focusedWindow()
        ?.webContents.send('file:command', command);
    },
  );
  dependencies.setApplicationMenu(
    dependencies.buildFromTemplate(template),
  );
}
