import { describe, expect, it, vi } from 'vitest';
import type { ThemeStudioApi } from '../electron';
import {
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
      openProject: vi.fn(),
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
});
