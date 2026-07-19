import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../../domain/theme';

const decoder = vi.hoisted(() => ({
  project: vi.fn(),
  ios: vi.fn(),
  androidSource: vi.fn(),
  androidApk: vi.fn(),
}));

vi.mock('../../domain/theme/codec', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../domain/theme/codec')>();
  return {
    ...actual,
    parseThemeProject(source: string) {
      decoder.project(source);
      return actual.parseThemeProject(source);
    },
  };
});

vi.mock('../../io/themeImport/importIosTheme', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../io/themeImport/importIosTheme')>();
  return {
    ...actual,
    async importIosKtheme(contents: Uint8Array, suggestedName: string) {
      const override = decoder.ios(contents, suggestedName);
      return override ?? actual.importIosKtheme(contents, suggestedName);
    },
  };
});

vi.mock('../../io/themeImport/importAndroidTheme', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../io/themeImport/importAndroidTheme')
  >();
  return {
    ...actual,
    async importAndroidSourceZip(
      contents: Uint8Array,
      suggestedName: string,
    ) {
      const override = decoder.androidSource(contents, suggestedName);
      return override
        ?? actual.importAndroidSourceZip(contents, suggestedName);
    },
    async importAndroidThemeArchive(
      contents: Uint8Array,
      suggestedName: string,
      metadata: unknown,
    ) {
      const override = decoder.androidApk(
        contents,
        suggestedName,
        metadata,
      );
      return override
        ?? actual.importAndroidThemeArchive(
          contents,
          suggestedName,
          metadata as never,
        );
    },
  };
});

import { createImportTheme } from './importTheme';

const legacyFixture = resolve(
  'src/test/fixtures/projects/flat-resources-0.1.1.ktstudio',
);

describe('import theme', () => {
  const selectFile = vi.fn();
  const readText = vi.fn();
  const readBytes = vi.fn();
  const basename = vi.fn((selected: string) => selected.split('/').at(-1)!);
  const inspect = vi.fn();
  const importTheme = createImportTheme({
    dialogs: { selectFile },
    files: { readText, readBytes },
    paths: { basename },
    androidInspector: { inspect },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    decoder.project.mockReset();
    decoder.ios.mockReset();
    decoder.androidSource.mockReset();
    decoder.androidApk.mockReset();
  });

  it('returns null on cancellation without reading or decoding anything', async () => {
    selectFile.mockResolvedValue(null);

    await expect(importTheme()).resolves.toBeNull();
    expect(readText).not.toHaveBeenCalled();
    expect(readBytes).not.toHaveBeenCalled();
    expect(inspect).not.toHaveBeenCalled();
    expect(decoder.project).not.toHaveBeenCalled();
    expect(decoder.ios).not.toHaveBeenCalled();
    expect(decoder.androidSource).not.toHaveBeenCalled();
    expect(decoder.androidApk).not.toHaveBeenCalled();
  });

  it('reads and migrates a historical project through the project codec', async () => {
    const content = await readFile(legacyFixture, 'utf8');
    selectFile.mockResolvedValue('/themes/legacy.ktstudio');
    readText.mockResolvedValue(content);

    const result = await importTheme();

    expect(result?.kind).toBe('project');
    expect(result?.project.schemaVersion).toBe(1);
    expect(result?.project.resources['common.theme-icon']).toMatchObject({
      fileName: 'theme-icon.png',
    });
    expect(readText).toHaveBeenCalledOnce();
    expect(readBytes).not.toHaveBeenCalled();
    expect(decoder.project).toHaveBeenCalledWith(content);
  });

  it.each([
    ['ios', '/themes/bear.ktheme', decoder.ios],
    ['android', '/themes/bear.zip', decoder.androidSource],
  ] as const)(
    'routes %s byte imports once with the exact suggested basename',
    async (kind, selected, decode) => {
    const bytes = new Uint8Array([1, 2, 3]);
    const project = createDefaultTheme('decoded');
    selectFile.mockResolvedValue(selected);
    readBytes.mockResolvedValue(bytes);
    decode.mockReturnValue(project);

    await expect(importTheme()).resolves.toEqual({ kind, project });
    expect(readBytes).toHaveBeenCalledOnce();
    expect(readText).not.toHaveBeenCalled();
    expect(decode).toHaveBeenCalledWith(bytes, 'bear' + (
      selected.endsWith('.ktheme') ? '.ktheme' : '.zip'
    ));
    },
  );

  it('passes the same APK bytes to the inspector and archive decoder', async () => {
    const selected = '/themes/bear.apk';
    const bytes = new Uint8Array([4, 5, 6]);
    const metadata = { name: 'Bear' };
    const project = createDefaultTheme('decoded');
    selectFile.mockResolvedValue(selected);
    readBytes.mockResolvedValue(bytes);
    inspect.mockResolvedValue(metadata);
    decoder.androidApk.mockReturnValue(project);

    await expect(importTheme()).resolves.toEqual({
      kind: 'android',
      project,
    });
    expect(readBytes).toHaveBeenCalledOnce();
    expect(inspect).toHaveBeenCalledWith(selected, bytes);
    expect(decoder.androidApk).toHaveBeenCalledWith(
      bytes,
      'bear.apk',
      metadata,
    );
    expect(inspect.mock.calls[0][1]).toBe(
      decoder.androidApk.mock.calls[0][0],
    );
  });

  it('preserves the typed unsupported-format diagnostic', async () => {
    selectFile.mockResolvedValue('/themes/bear.rar');

    await expect(importTheme()).rejects.toMatchObject({
      code: 'KTB-THEME-UNSUPPORTED-FORMAT',
      operation: 'theme:import',
      stage: '테마 파일 형식 확인',
    });
    expect(readText).not.toHaveBeenCalled();
    expect(readBytes).not.toHaveBeenCalled();
  });

  it.each([
    ['/themes/broken.ktheme', 'KTB-IOS-IMPORT-ARCHIVE', 'iPhone 테마 압축 읽기'],
    ['/themes/broken.zip', 'KTB-ANDROID-IMPORT-ARCHIVE', 'Android 테마 압축 읽기'],
    ['/themes/broken.apk', 'KTB-ANDROID-IMPORT-ARCHIVE', 'Android 테마 압축 읽기'],
  ] as const)(
    'preserves the format diagnostic for malformed %s input',
    async (selected, code, stage) => {
      selectFile.mockResolvedValue(selected);
      readBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
      inspect.mockResolvedValue({});

      await expect(importTheme()).rejects.toMatchObject({
        code,
        operation: 'theme:import',
        stage,
      });
    },
  );

  it.each([
    ['/themes/bear.ktstudio', 'text'],
    ['/themes/bear.ktheme', 'bytes'],
  ] as const)(
    'maps a %s read failure without leaking the selected path',
    async (selected, reader) => {
      const cause = Object.assign(new Error(`cannot read ${selected}`), {
        code: 'EIO',
      });
      selectFile.mockResolvedValue(selected);
      (reader === 'text' ? readText : readBytes).mockRejectedValue(cause);

      let failure: unknown;
      try {
        await importTheme();
      } catch (error) {
        failure = error;
      }
      expect(failure).toMatchObject({
        code: 'KTB-FS-READ',
        operation: 'theme:import',
        stage: '선택한 테마 파일 읽기',
        message: '선택한 테마 파일을 읽지 못했습니다.',
        cause,
        safeContext: { systemCode: 'EIO' },
      });
      expect(JSON.stringify(failure)).not.toContain(selected);
    },
  );

  it('does not convert decoder failures into cancellation', async () => {
    selectFile.mockResolvedValue('/themes/broken.ktheme');
    readBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));

    await expect(importTheme()).rejects.not.toBeNull();
  });
});
