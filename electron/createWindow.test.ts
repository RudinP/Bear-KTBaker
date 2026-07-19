import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createWindow,
  type BrowserWindowLike,
} from './createWindow';

type WindowEvent = 'ready-to-show';
type WebContentsEvent = 'will-navigate' | 'before-input-event';

function windowHarness() {
  const windowHandlers = new Map<WindowEvent, () => void>();
  const webContentsHandlers = new Map<WebContentsEvent, (...args: never[]) => void>();
  const window = {
    loadURL: vi.fn().mockResolvedValue(undefined),
    loadFile: vi.fn().mockResolvedValue(undefined),
    once: vi.fn((event: WindowEvent, handler: () => void) => {
      windowHandlers.set(event, handler);
      return window;
    }),
    show: vi.fn(),
    webContents: {
      getURL: vi.fn(() => 'http://localhost:5173/editor'),
      setWindowOpenHandler: vi.fn(),
      on: vi.fn((event: WebContentsEvent, handler: (...args: never[]) => void) => {
        webContentsHandlers.set(event, handler);
        return window.webContents;
      }),
      send: vi.fn(),
    },
  };

  return {
    window: window as unknown as BrowserWindowLike,
    rawWindow: window,
    windowHandlers,
    webContentsHandlers,
  };
}

describe('createWindow', () => {
  it.each([
    [
      'darwin',
      {
        titleBarStyle: 'hiddenInset',
        vibrancy: 'under-window',
        visualEffectState: 'active',
        backgroundMaterial: 'none',
      },
    ],
    [
      'win32',
      {
        titleBarStyle: 'default',
        vibrancy: undefined,
        visualEffectState: undefined,
        backgroundMaterial: 'acrylic',
      },
    ],
  ] as const)('preserves the %s window appearance and security options', async (
    platform,
    platformOptions,
  ) => {
    const harness = windowHarness();
    const makeWindow = vi.fn(() => harness.window);

    await createWindow({
      platform,
      developmentServerUrl: 'http://localhost:5173',
      applicationPath: '/application',
      preloadPath: '/application/dist-electron/preload.js',
      makeWindow,
    });

    expect(makeWindow).toHaveBeenCalledWith({
      width: 1360,
      height: 880,
      minWidth: 1060,
      minHeight: 710,
      show: false,
      title: 'Bear KTBaker',
      ...platformOptions,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: '/application/dist-electron/preload.js',
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
  });

  it('denies popups and navigation away from the current URL', async () => {
    const harness = windowHarness();
    await createWindow({
      platform: 'darwin',
      developmentServerUrl: 'http://localhost:5173',
      applicationPath: '/application',
      preloadPath: '/preload.js',
      makeWindow: () => harness.window,
    });

    const openHandler =
      harness.rawWindow.webContents.setWindowOpenHandler.mock.calls[0]?.[0];
    expect(openHandler?.({} as never)).toEqual({ action: 'deny' });

    const preventDefault = vi.fn();
    harness.webContentsHandlers.get('will-navigate')?.(
      { preventDefault } as never,
      'https://example.com' as never,
    );
    expect(preventDefault).toHaveBeenCalledOnce();

    preventDefault.mockClear();
    harness.webContentsHandlers.get('will-navigate')?.(
      { preventDefault } as never,
      'http://localhost:5173/editor' as never,
    );
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it.each([
    ['darwin', { type: 'keyDown', key: 'z', meta: true }, 'undo'],
    ['darwin', { type: 'keyDown', key: 'z', meta: true, shift: true }, 'redo'],
    ['win32', { type: 'keyDown', key: 'y', control: true }, 'redo'],
  ] as const)('sends only history commands for %s shortcuts', async (
    platform,
    input,
    command,
  ) => {
    const harness = windowHarness();
    await createWindow({
      platform,
      developmentServerUrl: 'http://localhost:5173',
      applicationPath: '/application',
      preloadPath: '/preload.js',
      makeWindow: () => harness.window,
    });
    const preventDefault = vi.fn();

    harness.webContentsHandlers.get('before-input-event')?.(
      { preventDefault } as never,
      input as never,
    );

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(harness.rawWindow.webContents.send)
      .toHaveBeenCalledWith('history:command', command);
  });

  it('ignores key-up and unrelated keyboard input', async () => {
    const harness = windowHarness();
    await createWindow({
      platform: 'linux',
      developmentServerUrl: 'http://localhost:5173',
      applicationPath: '/application',
      preloadPath: '/preload.js',
      makeWindow: () => harness.window,
    });
    const preventDefault = vi.fn();
    const handler = harness.webContentsHandlers.get('before-input-event');

    handler?.(
      { preventDefault } as never,
      { type: 'keyUp', key: 'z', control: true } as never,
    );
    handler?.(
      { preventDefault } as never,
      { type: 'keyDown', key: 'x', control: true } as never,
    );

    expect(preventDefault).not.toHaveBeenCalled();
    expect(harness.rawWindow.webContents.send).not.toHaveBeenCalled();
  });

  it('shows only after ready-to-show and loads the development URL', async () => {
    const harness = windowHarness();

    const created = await createWindow({
      platform: 'darwin',
      developmentServerUrl: 'http://localhost:5173',
      applicationPath: '/application',
      preloadPath: '/preload.js',
      makeWindow: () => harness.window,
    });

    expect(created).toBe(harness.window);
    expect(harness.rawWindow.show).not.toHaveBeenCalled();
    harness.windowHandlers.get('ready-to-show')?.();
    expect(harness.rawWindow.show).toHaveBeenCalledOnce();
    expect(harness.rawWindow.loadURL)
      .toHaveBeenCalledWith('http://localhost:5173');
    expect(harness.rawWindow.loadFile).not.toHaveBeenCalled();
  });

  it('loads the packaged renderer from the application path', async () => {
    const harness = windowHarness();

    await createWindow({
      platform: 'linux',
      applicationPath: '/opt/Bear KTBaker/resources/app.asar',
      preloadPath: '/preload.js',
      makeWindow: () => harness.window,
    });

    expect(harness.rawWindow.loadFile).toHaveBeenCalledWith(
      path.join(
        '/opt/Bear KTBaker/resources/app.asar',
        'dist',
        'index.html',
      ),
    );
    expect(harness.rawWindow.loadURL).not.toHaveBeenCalled();
  });
});
