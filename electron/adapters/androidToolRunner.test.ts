import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_CATALOG } from '../../src/application/errors/errorCatalog';
import { ThemeStudioError } from '../../src/application/errors/ThemeStudioError';
import type { AndroidApkBuildRequest } from '../../src/application/ports/androidApk';
import type { AndroidCompiledMetadata } from '../../src/io/themeImport';
import { ANDROID_SAMPLE_COLORS } from '../../src/manifest/kakaoColors';
import {
  AndroidStandaloneBuildError,
} from './androidStandaloneBuild';

const node = vi.hoisted(() => ({
  access: vi.fn(),
  readdir: vi.fn(),
  inspectCompiled: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    access: node.access,
    readdir: node.readdir,
  },
  access: node.access,
  readdir: node.readdir,
}));

vi.mock('../../src/io/androidCompiledMetadata', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../src/io/androidCompiledMetadata')
  >();
  return {
    ...actual,
    inspectCompiledAndroidApk: node.inspectCompiled,
  };
});

import {
  createAndroidApkBuilder,
  createAndroidApkInspector,
} from './androidToolRunner';

const completeColors = Object.fromEntries(
  Object.keys(ANDROID_SAMPLE_COLORS).map((name) => [name, '#112233']),
);
const completeMetadata = {
  colors: completeColors,
  themeId: 'com.example.theme',
  version: '0.1.3',
  name: 'Bear',
  appearance: 'dark' as const,
} satisfies AndroidCompiledMetadata;

describe('Android APK inspector adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    node.access.mockResolvedValue(undefined);
    node.readdir.mockResolvedValue(['34.0.0']);
  });

  it('adapts the exact supplied bytes to the built-in parser without rereading', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    node.inspectCompiled.mockResolvedValue(completeMetadata);
    const inspector = createAndroidApkInspector({
      platform: 'darwin',
      environment: {},
    });

    await expect(inspector.inspect('/private/bear.apk', bytes))
      .resolves.toEqual(completeMetadata);
    expect(node.inspectCompiled).toHaveBeenCalledOnce();
    expect(node.inspectCompiled.mock.calls[0][0]).toEqual(Buffer.from(bytes));
    expect(node.readdir).not.toHaveBeenCalled();
  });

  it('runs no external tool when built-in metadata is complete', async () => {
    const execute = vi.fn();
    const inspectCompiled = vi.fn().mockResolvedValue(completeMetadata);
    const inspector = createAndroidApkInspector({
      platform: 'darwin',
      environment: {},
      inspectCompiled,
      execute,
    });

    await inspector.inspect('/private/bear.apk', new Uint8Array([1]));

    expect(execute).not.toHaveBeenCalled();
    expect(node.readdir).not.toHaveBeenCalled();
  });

  it('continues to optional SDK fallback after a built-in parser failure', async () => {
    const execute = vi.fn(async (_executable, args: readonly string[]) => ({
      stdout: args.includes('badging')
        ? "package: name='com.example.fallback' versionName='0.1.3'\n"
          + "application-label-ko:'폴백 테마'"
        : args.includes('xmltree')
          ? 'com.kakao.talk.theme_style android:value="dark"'
          : '',
    }));
    const inspector = createAndroidApkInspector({
      platform: 'darwin',
      environment: { ANDROID_HOME: '/sdk' },
      inspectCompiled: vi.fn().mockRejectedValue(new Error('bad table')),
      execute,
    });

    await expect(inspector.inspect('/private/bear.apk', new Uint8Array([1])))
      .resolves.toMatchObject({
        themeId: 'com.example.fallback',
        version: '0.1.3',
        name: '폴백 테마',
        appearance: 'dark',
      });
    expect(execute).toHaveBeenCalled();
  });

  it('returns partial metadata when Android build-tools are unavailable', async () => {
    node.readdir.mockRejectedValue(new Error('missing SDK'));
    const partial = { name: 'Built-in title' };
    const execute = vi.fn();
    const inspector = createAndroidApkInspector({
      platform: 'linux',
      environment: { HOME: '/home/user' },
      inspectCompiled: vi.fn().mockResolvedValue(partial),
      execute,
    });

    await expect(inspector.inspect('/private/bear.apk', new Uint8Array([1])))
      .resolves.toEqual(partial);
    expect(execute).not.toHaveBeenCalled();
  });

  it('fills missing colors with aapt2 without overwriting built-in colors', async () => {
    const execute = vi.fn().mockResolvedValue({
      stdout: [
        'resource 0x7f060001 color/theme_maintab_cell_color',
        '  () #ff123456',
        'resource 0x7f060002 color/theme_title_color',
        '  () #80112233',
      ].join('\n'),
    });
    const inspector = createAndroidApkInspector({
      platform: 'darwin',
      environment: { ANDROID_HOME: '/sdk' },
      inspectCompiled: vi.fn().mockResolvedValue({
        ...completeMetadata,
        colors: { theme_maintab_cell_color: '#ABCDEF' },
      }),
      execute,
    });

    await expect(inspector.inspect('/private/bear.apk', new Uint8Array([1])))
      .resolves.toMatchObject({
        colors: {
          theme_maintab_cell_color: '#ABCDEF',
          theme_title_color: '#80112233',
        },
      });
    expect(execute).toHaveBeenCalledWith(
      '/sdk/build-tools/34.0.0/aapt2',
      ['dump', 'resources', '/private/bear.apk'],
      { maxBuffer: 20_000_000 },
    );
  });

  it('fills missing package, version, name, and appearance with aapt', async () => {
    const execute = vi.fn(async (_executable, args: readonly string[]) => ({
      stdout: args.includes('badging')
        ? "package: name='com.example.theme' versionName='0.1.3'\n"
          + "application-label-ko:'곰 테마'"
        : 'com.kakao.talk.theme_style xxxxxxxxx android:value="dark"',
    }));
    const inspector = createAndroidApkInspector({
      platform: 'darwin',
      environment: { ANDROID_HOME: '/sdk' },
      inspectCompiled: vi.fn().mockResolvedValue({ colors: completeColors }),
      execute,
    });

    await expect(inspector.inspect('/private/bear.apk', new Uint8Array([1])))
      .resolves.toMatchObject({
        themeId: 'com.example.theme',
        version: '0.1.3',
        name: '곰 테마',
        appearance: 'dark',
      });
    expect(execute).toHaveBeenNthCalledWith(
      1,
      '/sdk/build-tools/34.0.0/aapt',
      ['dump', 'badging', '/private/bear.apk'],
      { maxBuffer: 5_000_000 },
    );
    expect(execute).toHaveBeenNthCalledWith(
      2,
      '/sdk/build-tools/34.0.0/aapt',
      ['dump', 'xmltree', '/private/bear.apk', 'AndroidManifest.xml'],
      { maxBuffer: 5_000_000 },
    );
  });

  it('keeps available metadata when an identified optional command fails', async () => {
    const partial = { name: 'Built-in title' };
    const inspector = createAndroidApkInspector({
      platform: 'win32',
      environment: { ANDROID_HOME: 'C:\\sdk' },
      inspectCompiled: vi.fn().mockResolvedValue(partial),
      execute: vi.fn().mockRejectedValue(new Error('aapt failed')),
    });

    await expect(inspector.inspect('C:\\private\\bear.apk', new Uint8Array([1])))
      .resolves.toEqual(partial);
  });

  it('keeps Android sample-color normalization byte-for-byte compatible', async () => {
    const execute = vi.fn().mockResolvedValue({
      stdout: [
        'color/theme_maintab_cell_color',
        '  () #ffabcdef',
        'color/theme_title_color',
        '  () #7f0102a0',
      ].join('\n'),
    });
    const inspector = createAndroidApkInspector({
      platform: 'win32',
      environment: { ANDROID_HOME: 'C:\\sdk' },
      inspectCompiled: vi.fn().mockResolvedValue({
        themeId: 'com.example.theme',
        version: '0.1.3',
        name: 'Bear',
        appearance: 'light',
      }),
      execute,
    });

    const result = await inspector.inspect(
      'C:\\private\\bear.apk',
      new Uint8Array([1]),
    );

    expect(result.colors).toMatchObject({
      theme_maintab_cell_color: '#ABCDEF',
      theme_title_color: '#7F0102A0',
    });
    expect(execute).toHaveBeenCalledWith(
      'C:\\sdk/build-tools/34.0.0/aapt2.exe',
      ['dump', 'resources', 'C:\\private\\bear.apk'],
      { maxBuffer: 20_000_000 },
    );
  });
});

describe('Android APK builder adapter', () => {
  const request: AndroidApkBuildRequest = {
    buildDirectory: '/private/build',
    outputPath: '/private/build/verified-theme.apk',
    runtimeDirectory: '/app/android-runtime',
    signingIdentityPath: '/user/android-signing-identity.json',
    packageName: 'com.example.theme',
    versionCode: 10_203,
    versionName: '1.2.3',
    expectedMetadata: {
      name: 'Bear',
      appearance: 'dark',
      colors: { theme_header_color: '#123456' },
    },
    expectedImages: [],
  };

  it.each([
    ['runtime', 'KTB-ANDROID-RUNTIME-MISSING'],
    ['compile', 'KTB-ANDROID-AAPT2-COMPILE'],
    ['link', 'KTB-ANDROID-AAPT2-LINK'],
    ['signing-identity', 'KTB-ANDROID-SIGNING-IDENTITY'],
    ['sign', 'KTB-ANDROID-SIGN'],
    ['verify', 'KTB-ANDROID-VERIFY'],
  ] as const)(
    'maps %s failures to %s with only safe process context',
    async (stage, code) => {
      const failure = new AndroidStandaloneBuildError({
        stage,
        message: '/private/unsafe build failed',
        exitCode: 7,
        signal: 'SIGTERM',
        cause: { stdout: 'theme contents' },
      });
      const buildStandalone = vi.fn().mockRejectedValue(failure);
      const builder = createAndroidApkBuilder({
        platform: 'darwin',
        buildStandalone,
      });

      const error = await builder.build(request).catch(
        (caught) => caught,
      );
      expect(error).toMatchObject({
        code,
        operation: 'theme:export-android',
        stage: ERROR_CATALOG[code].stage,
        message: ERROR_CATALOG[code].message,
        safeContext: {
          exitCode: 7,
          signal: 'SIGTERM',
        },
        cause: failure,
      });
      expect(buildStandalone).toHaveBeenCalledWith({
        buildDir: request.buildDirectory,
        outputPath: request.outputPath,
        runtimeDir: request.runtimeDirectory,
        identityPath: request.signingIdentityPath,
        packageName: request.packageName,
        versionCode: request.versionCode,
        versionName: request.versionName,
        expectedMetadata: request.expectedMetadata,
        expectedImages: [],
        platform: 'darwin',
      });
      expect(buildStandalone).toHaveBeenCalledOnce();
      expect(Object.keys(error.safeContext)).toEqual([
        'exitCode',
        'signal',
      ]);
    },
  );

  it('never wraps an existing ThemeStudioError', async () => {
    const existing = new ThemeStudioError({
      code: 'KTB-FS-WRITE',
      operation: 'theme:export-android',
      stage: 'APK 쓰기',
      message: 'APK를 쓰지 못했습니다.',
    });
    const builder = createAndroidApkBuilder({
      platform: 'win32',
      buildStandalone: vi.fn().mockRejectedValue(existing),
    });

    let failure: unknown;
    try {
      await builder.build(request);
    } catch (error) {
      failure = error;
    }

    expect(failure).toBe(existing);
  });

  it('normalizes an unclassified build failure as unexpected', async () => {
    const builder = createAndroidApkBuilder({
      platform: 'darwin',
      buildStandalone: vi.fn().mockRejectedValue(
        new Error('unknown failure'),
      ),
    });

    await expect(builder.build(request)).rejects.toMatchObject({
      code: 'KTB-UNKNOWN-UNEXPECTED',
      operation: 'theme:export-android',
      stage: 'Android APK 빌드',
    });
  });
});
