// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import type { ThemeStudioApi } from '../electron';
import {
  THEME_STUDIO_UNAVAILABLE_MESSAGE,
  createThemeStudioClient,
  type HistoryCommand,
  type ThemeFileCommand,
  type ThemeImportResult,
} from './themeStudioClient';

describe('theme studio renderer client', () => {
  it('resolves preload at call time and preserves cancellation', async () => {
    let api: ThemeStudioApi | undefined;
    const client = createThemeStudioClient(() => api);

    expect(client.isAvailable()).toBe(false);

    api = {
      platform: 'darwin',
      importTheme: vi.fn().mockResolvedValue(null),
      saveProject: vi.fn().mockResolvedValue(null),
      exportIos: vi.fn(),
      exportAndroid: vi.fn(),
      saveScreenshots: vi.fn(),
    };

    expect(client.platform).toBe('darwin');
    const result: ThemeImportResult | null = await client.importTheme();
    expect(result).toBeNull();
  });

  it('returns no-op unsubscribers when preload subscriptions are absent', () => {
    const client = createThemeStudioClient(() => undefined);

    expect(() => client.subscribeHistoryCommands((_command: HistoryCommand) => undefined)())
      .not.toThrow();
    expect(() => client.subscribeFileCommands((_command: ThemeFileCommand) => undefined)())
      .not.toThrow();
  });

  it('uses the bridge-unavailable contract without a global window', () => {
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'window');

    try {
      const client = createThemeStudioClient();

      expect(client.isAvailable()).toBe(false);
      expect(() => client.subscribeHistoryCommands(() => undefined)()).not.toThrow();
      expect(() => client.subscribeFileCommands(() => undefined)()).not.toThrow();
      expect(() => client.importTheme()).toThrowError(new Error(THEME_STUDIO_UNAVAILABLE_MESSAGE));
      expect(() => client.saveProject('{}', 'theme')).toThrowError(new Error(THEME_STUDIO_UNAVAILABLE_MESSAGE));
      expect(() => client.exportIos({} as ThemeImportResult['project'])).toThrowError(new Error(THEME_STUDIO_UNAVAILABLE_MESSAGE));
      expect(() => client.exportAndroid({} as ThemeImportResult['project'])).toThrowError(new Error(THEME_STUDIO_UNAVAILABLE_MESSAGE));
      expect(() => client.saveScreenshots([])).toThrowError(new Error(THEME_STUDIO_UNAVAILABLE_MESSAGE));
    } finally {
      if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);
    }
  });
});
