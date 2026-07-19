import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { installApplicationMenu } from './installApplicationMenu';

function fileItems(template: MenuItemConstructorOptions[]) {
  const menu = template.find((item) => item.label === 'File');
  return (menu?.submenu as MenuItemConstructorOptions[])
    .filter((item) => item.label);
}

describe('installApplicationMenu', () => {
  it('builds and installs a menu whose file commands target the focused window', () => {
    let template: MenuItemConstructorOptions[] = [];
    const menu = { id: 'application-menu' };
    const send = vi.fn();
    const buildFromTemplate = vi.fn((value: MenuItemConstructorOptions[]) => {
      template = value;
      return menu;
    });
    const setApplicationMenu = vi.fn();

    installApplicationMenu({
      platform: 'darwin',
      buildFromTemplate: buildFromTemplate as never,
      setApplicationMenu: setApplicationMenu as never,
      focusedWindow: () => ({ webContents: { send } }) as never,
    });
    for (const item of fileItems(template)) {
      item.click?.({} as never, undefined as never, {} as never);
    }

    expect(send.mock.calls).toEqual([
      ['file:command', 'import-theme'],
      ['file:command', 'save-project'],
      ['file:command', 'finish-theme'],
    ]);
    expect(setApplicationMenu).toHaveBeenCalledWith(menu);
  });

  it('does nothing when a file command has no focused window', () => {
    let template: MenuItemConstructorOptions[] = [];

    installApplicationMenu({
      platform: 'win32',
      buildFromTemplate: ((value: MenuItemConstructorOptions[]) => {
        template = value;
        return {} as never;
      }) as never,
      setApplicationMenu: vi.fn(),
      focusedWindow: () => null,
    });

    expect(() => {
      for (const item of fileItems(template)) {
        item.click?.({} as never, undefined as never, {} as never);
      }
    }).not.toThrow();
  });
});
