import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeStudioError } from '../src/application/errors/ThemeStudioError';
import { serializeThemeStudioError } from '../src/application/errors/ipcPayload';
import { createDefaultTheme } from '../src/domain/theme/defaults';
import type { ThemeStudioApi } from '../src/electron';

const electron = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: electron.exposeInMainWorld,
  },
  ipcRenderer: {
    invoke: electron.invoke,
    on: electron.on,
    removeListener: electron.removeListener,
  },
}));

await import('./preload');

const api = electron.exposeInMainWorld.mock.calls[0]?.[1] as ThemeStudioApi;

describe('preload ThemeStudio API', () => {
  beforeEach(() => {
    electron.invoke.mockReset();
  });

  it('unwraps successful IPC results for every public invoke method', async () => {
    const project = createDefaultTheme('IPC 테마');
    const imported = { kind: 'project' as const, project };
    const screenshots = [{
      name: 'preview.png',
      dataUrl: 'data:image/png;base64,AA==',
    }];
    const cases = [
      {
        call: () => api.saveProject('{}', 'theme'),
        channel: 'project:save',
        args: [{ content: '{}', suggestedName: 'theme' }],
        value: '/theme.ktstudio',
      },
      {
        call: () => api.importTheme(),
        channel: 'theme:import',
        args: [],
        value: imported,
      },
      {
        call: () => api.exportIos(project),
        channel: 'theme:export-ios',
        args: [project],
        value: '/theme.ktheme',
      },
      {
        call: () => api.exportAndroid(project),
        channel: 'theme:export-android',
        args: [project],
        value: { path: '/theme.apk' },
      },
      {
        call: () => api.saveScreenshots(screenshots),
        channel: 'screenshots:save',
        args: [screenshots],
        value: '/screenshots',
      },
    ];

    for (const testCase of cases) {
      electron.invoke.mockResolvedValueOnce({
        ok: true,
        value: testCase.value,
      });
      await expect(testCase.call()).resolves.toEqual(testCase.value);
      expect(electron.invoke).toHaveBeenLastCalledWith(
        testCase.channel,
        ...testCase.args,
      );
    }
  });

  it('keeps cancellation null and Android error objects as successful values', async () => {
    electron.invoke
      .mockResolvedValueOnce({ ok: true, value: null })
      .mockResolvedValueOnce({
        ok: true,
        value: { error: 'Android build failed' },
      });

    await expect(api.importTheme()).resolves.toBeNull();
    await expect(api.exportAndroid(createDefaultTheme())).resolves.toEqual({
      error: 'Android build failed',
    });
  });

  it('throws a formatted support error for a failed IPC result', async () => {
    electron.invoke.mockResolvedValueOnce({
      ok: false,
      error: serializeThemeStudioError(new ThemeStudioError({
        code: 'KTB-IPC-INVALID-REQUEST',
        operation: 'ipc:validate',
        stage: '요청 데이터 검증',
        message: '앱 요청 데이터가 올바르지 않습니다.',
      })),
    });

    await expect(api.saveProject('{}', 'theme')).rejects.toThrow(
      [
        '[KTB-IPC-INVALID-REQUEST]',
        '앱 요청 데이터가 올바르지 않습니다.',
        '단계: 요청 데이터 검증',
      ].join('\n'),
    );
  });

  it.each([
    ['rejected invocation', () => electron.invoke.mockRejectedValueOnce(
      new Error('/Users/person/private.ktstudio token=secret'),
    )],
    ['undefined response', () => electron.invoke.mockResolvedValueOnce(undefined)],
    ['null response', () => electron.invoke.mockResolvedValueOnce(null)],
    ['missing success value', () => electron.invoke.mockResolvedValueOnce({ ok: true })],
    ['invalid failure payload', () => electron.invoke.mockResolvedValueOnce({
      ok: false,
      error: new Error('/Users/person/private.ktstudio token=secret'),
    })],
    ['unknown envelope field', () => electron.invoke.mockResolvedValueOnce({
      ok: true,
      value: '/theme.ktstudio',
      privatePath: '/Users/person/private.ktstudio',
    })],
    ['hostile malformed response', () => electron.invoke.mockResolvedValueOnce(
      new Proxy({}, {
        getPrototypeOf() {
          throw new Error('/Users/person/private.ktstudio token=secret');
        },
      }),
    )],
  ])('maps a %s to the privacy-safe bridge diagnostic', async (_label, arrange) => {
    arrange();

    let failure: unknown;
    try {
      await api.importTheme();
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).toContain('[KTB-IPC-BRIDGE-UNAVAILABLE]');
    expect(String(failure)).toContain('Electron 앱 기능에 연결하지 못했습니다.');
    expect(String(failure)).toContain('단계: 렌더러 브리지 연결');
    expect(String(failure)).not.toContain('/Users/person');
    expect(String(failure)).not.toContain('token=secret');
    expect(String(failure)).not.toContain('TypeError');
  });
});
