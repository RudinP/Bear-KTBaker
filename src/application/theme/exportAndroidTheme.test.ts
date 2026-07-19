import path from 'node:path';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeStudioError } from '../errors/ThemeStudioError';
import type { AndroidApkBuilderPort } from '../ports/androidApk';
import type { FileSystemPort, PathPort } from '../ports/fileSystem';
import type { ImageProcessorPort } from '../ports/imageProcessor';
import { createDefaultTheme } from '../../domain/theme/defaults';
import type { ThemeProject } from '../../domain/theme/model';
import { buildNinePatchPng } from '../../io/ninePatchPng';
import {
  buildAndroidColorsXml,
  buildAndroidManifest,
  buildAndroidStringsXml,
} from '../../io/androidTheme';
import {
  prepareStandaloneAndroidManifest,
} from '../../io/androidStandaloneManifest';
import { createExportAndroidTheme } from './exportAndroidTheme';

const templatePath = '/app/templates/android-source.zip';
const runtimePath = '/app/templates/android-runtime';
const identityPath = '/user/android-signing-identity.json';
const buildDirectory = '/tmp/ktbaker-android-test';
const destination = '/themes/bear.apk';
const colorsRelative = 'src/main/theme/values/colors.xml';
const manifestRelative = 'src/main/AndroidManifest.xml';
const stringsPaths = [
  'src/main/theme/values/strings.xml',
  'src/main/theme/values-ko/strings.xml',
] as const;
const manifestTemplate = [
  '<manifest xmlns:android="http://schemas.android.com/apk/res/android"',
  ' xmlns:tools="http://schemas.android.com/tools">',
  '<application tools:ignore="AllowBackup">',
  '<activity android:name=".MainActivity" />',
  '</application>',
  '</manifest>',
].join('');

function png(width: number, height: number): Uint8Array {
  const image = new PNG({ width, height });
  image.data.fill(255);
  return PNG.sync.write(image);
}

function dataUrl(bytes: Uint8Array) {
  return `data:image/png;base64,${
    Buffer.from(bytes).toString('base64')
  }`;
}

function colorsTemplate(project: ThemeProject) {
  return [
    '<resources>',
    ...Object.keys(project.colorValues.android).map(
      (name) => `<color name="${name}">#000000</color>`,
    ),
    '</resources>',
  ].join('\n');
}

async function archive(
  entries: Record<string, string | Uint8Array>,
) {
  const zip = new JSZip();
  for (const [name, contents] of Object.entries(entries)) {
    zip.file(name, contents);
  }
  return zip.generateAsync({ type: 'uint8array' });
}

interface HarnessOptions {
  project?: ThemeProject;
  entries?: Record<string, string | Uint8Array>;
  selectPath?: string | null;
  writeBytesFailure?: unknown;
  builderFailure?: unknown;
  copyFailure?: unknown;
  cleanupFailure?: unknown;
}

async function createHarness(options: HarnessOptions = {}) {
  const project =
    options.project ?? createDefaultTheme('곰 테마', false);
  const entries = options.entries ?? {
    [colorsRelative]: colorsTemplate(project),
    [manifestRelative]: manifestTemplate,
  };
  const template = await archive(entries);
  const storage = new Map<string, Uint8Array>();
  const selectSavePath = vi.fn().mockResolvedValue(
    options.selectPath === undefined
      ? destination
      : options.selectPath,
  );
  const readBytes = vi.fn<FileSystemPort['readBytes']>(
    async (filePath) => {
      if (filePath === templatePath) return template;
      const value = storage.get(filePath);
      if (!value) throw Object.assign(new Error('missing'), {
        code: 'ENOENT',
      });
      return value;
    },
  );
  const readText = vi.fn<FileSystemPort['readText']>(
    async (filePath) => new TextDecoder().decode(
      await readBytes(filePath),
    ),
  );
  const readOptionalBytes =
    vi.fn<FileSystemPort['readOptionalBytes']>(
      async (filePath) => storage.get(filePath) ?? null,
    );
  const writeBytes = vi.fn<FileSystemPort['writeBytes']>(
    async (filePath, contents) => {
      if (options.writeBytesFailure) {
        throw options.writeBytesFailure;
      }
      storage.set(filePath, contents.slice());
    },
  );
  const writeText = vi.fn<FileSystemPort['writeText']>(
    async (filePath, contents) => {
      storage.set(filePath, new TextEncoder().encode(contents));
    },
  );
  const copyFile = vi.fn<FileSystemPort['copyFile']>(
    async () => {
      if (options.copyFailure) throw options.copyFailure;
    },
  );
  const ensureDirectory =
    vi.fn<FileSystemPort['ensureDirectory']>();
  const createTemporaryDirectory =
    vi.fn<FileSystemPort['createTemporaryDirectory']>()
      .mockResolvedValue(buildDirectory);
  const removeDirectory =
    vi.fn<FileSystemPort['removeDirectory']>(
      async () => {
        if (options.cleanupFailure) {
          throw options.cleanupFailure;
        }
      },
    );
  const files: FileSystemPort = {
    readText,
    readBytes,
    readOptionalBytes,
    writeText,
    writeBytes,
    copyFile,
    ensureDirectory,
    createTemporaryDirectory,
    removeDirectory,
  };
  const join = vi.fn<PathPort['join']>(path.posix.join);
  const paths: PathPort = {
    join,
    dirname: path.posix.dirname,
    basename: path.posix.basename,
    isAbsolute: path.posix.isAbsolute,
  };
  const dimensions = vi.fn<ImageProcessorPort['dimensions']>(
    (source) => {
      try {
        const image = PNG.sync.read(Buffer.from(source));
        return { width: image.width, height: image.height };
      } catch {
        return null;
      }
    },
  );
  const resizeToPng =
    vi.fn<ImageProcessorPort['resizeToPng']>(
      ({ width, height }) => png(width, height),
    );
  const build = vi.fn<AndroidApkBuilderPort['build']>(
    async () => {
      if (options.builderFailure) {
        throw options.builderFailure;
      }
    },
  );
  const report = vi.fn();
  const exportAndroidTheme = createExportAndroidTheme({
    dialogs: { selectSavePath },
    files,
    paths,
    images: { dimensions, resizeToPng },
    androidBuilder: { build },
    diagnostics: { report },
    androidSourceTemplatePath: templatePath,
    androidRuntimeDirectory: runtimePath,
    signingIdentityPath: identityPath,
  });
  return {
    project,
    exportAndroidTheme,
    storage,
    selectSavePath,
    readBytes,
    writeBytes,
    writeText,
    copyFile,
    createTemporaryDirectory,
    removeDirectory,
    join,
    build,
    report,
  };
}

describe('export Android theme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null on cancellation without creating a temporary directory', async () => {
    const harness = await createHarness({ selectPath: null });

    await expect(harness.exportAndroidTheme(harness.project))
      .resolves.toBeNull();
    expect(harness.createTemporaryDirectory).not.toHaveBeenCalled();
    expect(harness.removeDirectory).not.toHaveBeenCalled();
    expect(harness.report).not.toHaveBeenCalled();
  });

  it.each([
    '../escape.txt',
    '/absolute.txt',
  ])(
    'rejects unsafe archive entry %s before joining or writing',
    async (entry) => {
      const harness = await createHarness({
        entries: {
          [entry]: 'unsafe',
          [colorsRelative]: colorsTemplate(
            createDefaultTheme('곰 테마', false),
          ),
        },
      });

      await expect(
        harness.exportAndroidTheme(harness.project),
      ).rejects.toMatchObject({
        code: 'KTB-FS-READ',
        stage: 'Android 템플릿 압축 읽기',
      });
      expect(harness.join).not.toHaveBeenCalled();
      expect(harness.writeBytes).not.toHaveBeenCalled();
      expect(harness.removeDirectory).toHaveBeenCalledOnce();
    },
  );

  it('writes exact colors, standalone manifest, and both strings files', async () => {
    const harness = await createHarness();

    await harness.exportAndroidTheme(harness.project);

    const colors = new TextDecoder().decode(harness.storage.get(
      path.posix.join(buildDirectory, colorsRelative),
    ));
    expect(colors).toBe(buildAndroidColorsXml(
      harness.project,
      colorsTemplate(harness.project),
    ));
    const manifest = new TextDecoder().decode(harness.storage.get(
      path.posix.join(buildDirectory, manifestRelative),
    ));
    expect(manifest).toBe(prepareStandaloneAndroidManifest(
      buildAndroidManifest(harness.project, manifestTemplate),
    ));
    for (const relativePath of stringsPaths) {
      expect(new TextDecoder().decode(harness.storage.get(
        path.posix.join(buildDirectory, relativePath),
      ))).toBe(buildAndroidStringsXml(harness.project));
    }
  });

  it('passes exact package metadata, all colors, and both maintab expectations to the builder', async () => {
    const project = createDefaultTheme('검증 테마', false);
    project.meta.themeId = '123 Theme';
    project.meta.version = 'v2.beta3.4 rc';
    project.meta.appearance = 'dark';
    const target = buildNinePatchPng(png(10, 10), {
      stretch: { x: [0, 1], y: [0, 1] },
      content: {
        left: 0,
        top: 0,
        right: 1,
        bottom: 1,
      },
    });
    project.platformResources.android['main.tab.background'] = {
      fileName: 'tab.png',
      dataUrl: dataUrl(png(5, 5)),
    };
    const harness = await createHarness({
      project,
      entries: {
        [colorsRelative]: colorsTemplate(project),
        [manifestRelative]: manifestTemplate,
        'src/main/theme/drawable-xxhdpi/theme_maintab_cell_image.9.png':
          target,
        'src/main/theme/drawable-sw600dp/theme_maintab_cell_image.9.png':
          target,
      },
    });

    await harness.exportAndroidTheme(project);

    const request = harness.build.mock.calls[0][0];
    expect(request).toMatchObject({
      buildDirectory,
      outputPath: path.posix.join(
        buildDirectory,
        'verified-theme.apk',
      ),
      runtimeDirectory: runtimePath,
      signingIdentityPath: identityPath,
      packageName: 'com.themestudio.t123theme',
      versionCode: 20_304,
      versionName: 'v2.beta3.4rc',
      expectedMetadata: {
        name: '검증 테마',
        appearance: 'dark',
        colors: project.colorValues.android,
      },
    });
    expect(Object.keys(request.expectedMetadata.colors)).toHaveLength(44);
    expect(request.expectedImages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceId: 'main.tab.background',
        sourcePath:
          'src/main/theme/drawable-xxhdpi/theme_maintab_cell_image.9.png',
        resourceKey: 'drawable/theme_maintab_cell_image',
        semanticQualifier: 'drawable-xxhdpi',
        ninePatch: true,
      }),
      expect.objectContaining({
        resourceId: 'main.tab.background',
        sourcePath:
          'src/main/theme/drawable-sw600dp/theme_maintab_cell_image.9.png',
        resourceKey: 'drawable/theme_maintab_cell_image',
        semanticQualifier: 'drawable-sw600dp',
        ninePatch: true,
      }),
    ]));
  });

  it('copies the verified APK and returns its selected path', async () => {
    const harness = await createHarness();

    await expect(harness.exportAndroidTheme(harness.project))
      .resolves.toEqual({ path: destination });
    expect(harness.copyFile).toHaveBeenCalledWith(
      path.posix.join(buildDirectory, 'verified-theme.apk'),
      destination,
    );
    expect(harness.removeDirectory).toHaveBeenCalledOnce();
    expect(harness.report).not.toHaveBeenCalled();
  });

  it.each([
    'resource-write',
    'builder',
    'copy',
  ] as const)(
    'removes the temporary directory once after %s failure',
    async (failurePoint) => {
      const failure = new Error(`${failurePoint} failed`);
      const harness = await createHarness({
        ...(failurePoint === 'resource-write'
          ? { writeBytesFailure: failure }
          : {}),
        ...(failurePoint === 'builder'
          ? { builderFailure: failure }
          : {}),
        ...(failurePoint === 'copy'
          ? { copyFailure: failure }
          : {}),
      });

      await expect(
        harness.exportAndroidTheme(harness.project),
      ).rejects.toBeDefined();
      expect(harness.removeDirectory).toHaveBeenCalledOnce();
    },
  );

  it('keeps the primary typed failure when cleanup also fails', async () => {
    const primary = new ThemeStudioError({
      code: 'KTB-ANDROID-AAPT2-COMPILE',
      operation: 'theme:export-android',
      stage: 'APK 리소스 컴파일',
      message: 'Android 리소스 컴파일에 실패했습니다.',
      safeContext: { exitCode: 1 },
    });
    const harness = await createHarness({
      builderFailure: primary,
      cleanupFailure: new Error('cleanup failed'),
    });

    let failure: unknown;
    try {
      await harness.exportAndroidTheme(harness.project);
    } catch (error) {
      failure = error;
    }

    expect(failure).toBe(primary);
    expect(harness.removeDirectory).toHaveBeenCalledOnce();
    expect(harness.report).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'KTB-FS-TEMP',
        operation: 'theme:export-android',
        stage: 'Android 임시 폴더 정리',
      }),
    );
    expect(harness.report.mock.calls[0][0].safeContext)
      .toBeUndefined();
  });

  it('reports cleanup failure after copy but still returns the path', async () => {
    const harness = await createHarness({
      cleanupFailure: new Error('cleanup failed'),
    });

    await expect(harness.exportAndroidTheme(harness.project))
      .resolves.toEqual({ path: destination });
    expect(harness.copyFile).toHaveBeenCalledOnce();
    expect(harness.report).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'KTB-FS-TEMP',
        stage: 'Android 임시 폴더 정리',
      }),
    );
  });
});
