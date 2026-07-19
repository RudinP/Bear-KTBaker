import { parseThemeProject } from '../../domain/theme/codec';
import type { ThemeProject } from '../../domain/theme/model';
import {
  detectThemeImportKind,
  type ThemeImportKind,
} from '../../io/themeImport/detectImportKind';
import {
  importAndroidSourceZip,
  importAndroidThemeArchive,
} from '../../io/themeImport/importAndroidTheme';
import { importIosKtheme } from '../../io/themeImport/importIosTheme';
import {
  normalizeThemeStudioError,
} from '../errors/ThemeStudioError';
import type { AndroidApkInspectorPort } from '../ports/androidApk';
import type { DialogPort } from '../ports/dialog';
import type { FileSystemPort, PathPort } from '../ports/fileSystem';
import { mapThemeImportFailure } from './importErrorMapping';
import { mapProjectCodecFailure } from './projectErrorMapping';

export type ImportThemeResult =
  | { kind: 'project'; project: ThemeProject }
  | { kind: 'ios'; project: ThemeProject }
  | { kind: 'android'; project: ThemeProject };

export type ImportTheme = () => Promise<ImportThemeResult | null>;

export function createImportTheme(
  dependencies: {
    dialogs: Pick<DialogPort, 'selectFile'>;
    files: Pick<FileSystemPort, 'readText' | 'readBytes'>;
    paths: Pick<PathPort, 'basename'>;
    androidInspector: AndroidApkInspectorPort;
  },
): ImportTheme {
  return async () => {
    const selected = await dependencies.dialogs.selectFile({
      title: '기존 테마 또는 프로젝트 열기',
      filters: [{
        name: '지원하는 테마',
        extensions: ['ktstudio', 'ktheme', 'apk', 'zip'],
      }],
    });
    if (!selected) return null;

    let kind: ThemeImportKind;
    try {
      kind = detectThemeImportKind(selected);
    } catch (error) {
      throw mapThemeImportFailure(error);
    }

    if (kind === 'project') {
      const content = await readSelectedText(selected, dependencies.files);
      try {
        return {
          kind: 'project',
          project: parseThemeProject(content),
        };
      } catch (error) {
        throw mapProjectCodecFailure(error, 'theme:import');
      }
    }

    const contents = await readSelectedBytes(selected, dependencies.files);
    const suggestedName = dependencies.paths.basename(selected);
    try {
      if (kind === 'ios') {
        return {
          kind: 'ios',
          project: await importIosKtheme(contents, suggestedName),
        };
      }
      if (kind === 'android-apk') {
        const metadata = await dependencies.androidInspector.inspect(
          selected,
          contents,
        );
        return {
          kind: 'android',
          project: await importAndroidThemeArchive(
            contents,
            suggestedName,
            metadata,
          ),
        };
      }
      return {
        kind: 'android',
        project: await importAndroidSourceZip(contents, suggestedName),
      };
    } catch (error) {
      throw mapThemeImportFailure(error);
    }
  };
}

async function readSelectedText(
  selected: string,
  files: Pick<FileSystemPort, 'readText'>,
) {
  try {
    return await files.readText(selected);
  } catch (cause) {
    throw normalizeThemeStudioError(cause, {
      code: 'KTB-FS-READ',
      operation: 'theme:import',
      stage: '선택한 테마 파일 읽기',
      message: '선택한 테마 파일을 읽지 못했습니다.',
    });
  }
}

async function readSelectedBytes(
  selected: string,
  files: Pick<FileSystemPort, 'readBytes'>,
) {
  try {
    return await files.readBytes(selected);
  } catch (cause) {
    throw normalizeThemeStudioError(cause, {
      code: 'KTB-FS-READ',
      operation: 'theme:import',
      stage: '선택한 테마 파일 읽기',
      message: '선택한 테마 파일을 읽지 못했습니다.',
    });
  }
}
