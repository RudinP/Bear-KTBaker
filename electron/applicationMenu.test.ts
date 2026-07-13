import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { createApplicationMenuTemplate, type FileCommand } from './applicationMenu';

describe('Electron application menu', () => {
  it('puts the three real file actions in the File menu', () => {
    const send = vi.fn<(command: FileCommand) => void>();
    const template = createApplicationMenuTemplate('darwin', send);
    const fileMenu = template.find((item) => item.label === 'File');
    const items = fileMenu?.submenu as MenuItemConstructorOptions[];

    expect(items.map((item) => item.label).filter(Boolean)).toEqual([
      '불러오기',
      '테마 저장',
      '테마 완성하기',
    ]);

    for (const item of items.filter((entry) => entry.label)) {
      item.click?.({} as never, undefined as never, {} as never);
    }
    expect(send.mock.calls.map(([command]) => command)).toEqual([
      'import-theme',
      'save-project',
      'finish-theme',
    ]);
  });

  it('keeps the standard app, edit, view, and window menus on macOS', () => {
    const template = createApplicationMenuTemplate('darwin', vi.fn());
    expect(template.map((item) => item.role ?? item.label)).toEqual([
      'appMenu', 'File', 'editMenu', 'viewMenu', 'windowMenu',
    ]);
  });
});
