import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { createApplicationMenuTemplate, type FileCommand } from './applicationMenu';

function fileMenuItems(template: MenuItemConstructorOptions[]) {
  const fileMenu = template.find((item) => item.label === 'File');
  return fileMenu?.submenu as MenuItemConstructorOptions[];
}

describe('Electron application menu', () => {
  it('puts the three real file actions in the File menu', () => {
    const send = vi.fn<(command: FileCommand) => void>();
    const template = createApplicationMenuTemplate('darwin', send);
    const items = fileMenuItems(template);

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
    expect(fileMenuItems(template).at(-1)?.role).toBe('close');
  });

  it('omits the app menu on Windows', () => {
    const template = createApplicationMenuTemplate('win32', vi.fn());

    expect(template.map((item) => item.role ?? item.label)).toEqual([
      'File', 'editMenu', 'viewMenu', 'windowMenu',
    ]);
  });

  it('uses quit instead of close as the terminal Windows file action', () => {
    const template = createApplicationMenuTemplate('win32', vi.fn());

    expect(fileMenuItems(template).at(-1)?.role).toBe('quit');
    expect(fileMenuItems(template).at(-1)?.role).not.toBe('close');
  });
});
