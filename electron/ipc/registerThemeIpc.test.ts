import {
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';
import { ThemeStudioError } from '../../src/application/errors/ThemeStudioError';
import { createDefaultTheme } from '../../src/domain/theme/defaults';
import {
  registerThemeIpc,
  type ThemeIpcUseCases,
} from './registerThemeIpc';

type RegisteredHandler = (
  event: Electron.IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<unknown>;

const channels = [
  'project:save',
  'theme:import',
  'theme:export-ios',
  'theme:export-android',
  'screenshots:save',
] as const;

function event(url = 'file:///Applications/Bear%20KTBaker/dist/index.html') {
  return {
    senderFrame: { url },
  } as unknown as Electron.IpcMainInvokeEvent;
}

function createUseCases(): ThemeIpcUseCases {
  return {
    saveProject: vi.fn().mockResolvedValue('/saved'),
    importTheme: vi.fn().mockResolvedValue('/imported'),
    exportIos: vi.fn().mockResolvedValue('/ios'),
    exportAndroid: vi.fn().mockResolvedValue({ path: '/android.apk' }),
    saveScreenshots: vi.fn().mockResolvedValue('/screenshots'),
  } as unknown as ThemeIpcUseCases;
}

describe('registerThemeIpc', () => {
  let handlers: Map<string, RegisteredHandler>;
  let registrations: string[];
  let useCases: ThemeIpcUseCases;
  let report: Mock<(error: ThemeStudioError) => void>;

  beforeEach(() => {
    handlers = new Map();
    registrations = [];
    useCases = createUseCases();
    report = vi.fn();
    registerThemeIpc({
      ipc: {
        handle: vi.fn((channel, handler) => {
          registrations.push(channel);
          handlers.set(channel, handler as RegisteredHandler);
        }),
      },
      senderPolicy: {
        developmentServerUrl: 'http://localhost:5173/',
        packagedRendererUrl:
          'file:///Applications/Bear%20KTBaker/dist/index.html',
      },
      useCases,
      diagnostics: { report },
    });
  });

  function handler(channel: typeof channels[number]) {
    const registered = handlers.get(channel);
    if (!registered) throw new Error(`Missing handler: ${channel}`);
    return registered;
  }

  it('registers the shared invoke channels exactly once', () => {
    expect(registrations).toEqual(channels);
    expect(new Set(registrations)).toHaveLength(5);
  });

  it.each([
    ['project:save', [{ content: '{}', suggestedName: 'theme' }]],
    ['theme:import', []],
    ['theme:export-ios', [createDefaultTheme()]],
    ['theme:export-android', [createDefaultTheme()]],
    ['screenshots:save', [[{
      name: 'preview.png',
      dataUrl: 'data:image/png;base64,AA==',
    }]]],
  ] as const)(
    'rejects an untrusted sender before parsing or executing %s',
    async (channel, args) => {
      const unreadableArgs = args.length === 0
        ? []
        : [new Proxy({}, {
            get() {
              throw new Error('request parsing started');
            },
          })];

      const result = await handler(channel)(
        event('file:///Applications/Evil/dist/index.html'),
        ...unreadableArgs,
      );

      expect(result).toMatchObject({
        ok: false,
        error: { code: 'KTB-IPC-UNTRUSTED-SENDER' },
      });
      expect(useCases.saveProject).not.toHaveBeenCalled();
      expect(useCases.importTheme).not.toHaveBeenCalled();
      expect(useCases.exportIos).not.toHaveBeenCalled();
      expect(useCases.exportAndroid).not.toHaveBeenCalled();
      expect(useCases.saveScreenshots).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['project:save', 'saveProject'],
    ['theme:export-ios', 'exportIos'],
    ['theme:export-android', 'exportAndroid'],
    ['screenshots:save', 'saveScreenshots'],
  ] as const)(
    'rejects malformed %s payloads without starting the use case',
    async (channel, useCase) => {
      const result = await handler(channel)(event(), { unexpected: true });

      expect(result).toMatchObject({
        ok: false,
        error: { code: 'KTB-IPC-INVALID-REQUEST' },
      });
      expect(useCases[useCase]).not.toHaveBeenCalled();
    },
  );

  it.each(channels)(
    'preserves cancellation without diagnostics for %s',
    async (channel) => {
      for (const useCase of Object.values(useCases)) {
        vi.mocked(useCase).mockResolvedValueOnce(null as never);
      }
      const project = createDefaultTheme();
      const args: Record<typeof channels[number], unknown[]> = {
        'project:save': [{ content: JSON.stringify(project), suggestedName: 'theme' }],
        'theme:import': [],
        'theme:export-ios': [project],
        'theme:export-android': [project],
        'screenshots:save': [[{
          name: 'preview.png',
          dataUrl: 'data:image/png;base64,AA==',
        }]],
      };

      await expect(handler(channel)(event(), ...args[channel]))
        .resolves.toEqual({ ok: true, value: null });
      expect(report).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'project:save',
      'saveProject',
      [{ content: JSON.stringify(createDefaultTheme()), suggestedName: 'theme' }],
    ],
    ['theme:import', 'importTheme', []],
    ['theme:export-ios', 'exportIos', [createDefaultTheme()]],
    [
      'screenshots:save',
      'saveScreenshots',
      [[{
        name: 'preview.png',
        dataUrl: 'data:image/png;base64,AA==',
      }]],
    ],
  ] as const)(
    'returns and reports a structured %s failure exactly once',
    async (channel, useCase, args) => {
      vi.mocked(useCases[useCase]).mockRejectedValueOnce(
        new Error('native failure'),
      );

      const result = await handler(channel)(event(), ...args);

      expect(result).toMatchObject({
        ok: false,
        error: { operation: channel },
      });
      expect(report).toHaveBeenCalledOnce();
      expect(report.mock.calls[0]?.[0]).toBeInstanceOf(ThemeStudioError);
    },
  );

  it('returns the Android success value unchanged', async () => {
    const project = createDefaultTheme();

    await expect(handler('theme:export-android')(event(), project))
      .resolves.toEqual({
        ok: true,
        value: { path: '/android.apk' },
      });
    expect(useCases.exportAndroid).toHaveBeenCalledWith(project);
  });

  it('reports Android failures once as successful compatibility values', async () => {
    useCases.exportAndroid = vi.fn().mockRejectedValueOnce(
      new ThemeStudioError({
        code: 'KTB-ANDROID-SIGN',
        operation: 'theme:export-android',
        stage: 'Android APK 서명',
        message: 'Android APK 서명에 실패했습니다.',
      }),
    );

    const result = await handler('theme:export-android')(
      event(),
      createDefaultTheme(),
    );

    expect(result).toEqual({
      ok: true,
      value: {
        error: [
          '[KTB-ANDROID-SIGN]',
          'Android APK 서명에 실패했습니다.',
          '단계: Android APK 서명',
        ].join('\n'),
      },
    });
    expect(report).toHaveBeenCalledOnce();
    expect(report.mock.calls[0]?.[0]).toBeInstanceOf(ThemeStudioError);
  });
});
