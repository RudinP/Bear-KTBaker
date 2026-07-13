import type { MenuItemConstructorOptions } from 'electron';

export type FileCommand = 'import-theme' | 'save-project' | 'finish-theme';

export function createApplicationMenuTemplate(
  platform: NodeJS.Platform,
  send: (command: FileCommand) => void,
): MenuItemConstructorOptions[] {
  const isMac = platform === 'darwin';
  const fileItems: MenuItemConstructorOptions[] = [
    { label: '불러오기', accelerator: 'CmdOrCtrl+O', click: () => send('import-theme') },
    { label: '테마 저장', accelerator: 'CmdOrCtrl+S', click: () => send('save-project') },
    { type: 'separator' },
    { label: '테마 완성하기', accelerator: 'CmdOrCtrl+Shift+E', click: () => send('finish-theme') },
    { type: 'separator' },
    { role: isMac ? 'close' : 'quit' },
  ];

  return [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    { label: 'File', submenu: fileItems },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
}
