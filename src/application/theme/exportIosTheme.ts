import type { ThemeProject } from '../../domain/theme';
import {
  decodeArchiveEntries,
  encodeCleanArchiveEntries,
  type ArchiveEntry,
} from '../../io/archiveEntries';
import { buildIosCss } from '../../io/iosTheme';
import {
  normalizeThemeStudioError,
  ThemeStudioError,
} from '../errors/ThemeStudioError';
import type { DialogPort } from '../ports/dialog';
import type { FileSystemPort } from '../ports/fileSystem';
import type { ImageProcessorPort } from '../ports/imageProcessor';
import { renderIosImages } from './renderIosImages';

export type ExportIosTheme = (
  project: ThemeProject,
) => Promise<string | null>;

export function createExportIosTheme(
  dependencies: {
    dialogs: Pick<DialogPort, 'selectSavePath'>;
    files: Pick<FileSystemPort, 'readBytes' | 'writeBytes'>;
    images: ImageProcessorPort;
    iosTemplatePath: string;
  },
): ExportIosTheme {
  return async (project) => {
    const destination = await dependencies.dialogs.selectSavePath({
      title: 'iPhone 테마 저장',
      defaultPath: `${project.meta.name}.ktheme`,
      filters: [{
        name: '카카오톡 iPhone 테마',
        extensions: ['ktheme'],
      }],
    });
    if (!destination) return null;

    const templateBytes = await readIosTemplate(
      dependencies.files,
      dependencies.iosTemplatePath,
    );
    const templateEntries = await decodeIosTemplate(templateBytes);
    const css = requireIosCss(templateEntries);
    const withCss = replaceArchiveEntry(
      templateEntries,
      'KakaoTalkTheme.css',
      new TextEncoder().encode(buildIosCss(project, css)),
    );
    const withImages = await renderIosImages({
      entries: withCss,
      project,
      images: dependencies.images,
    });
    const output = await encodeCleanArchiveEntries(withImages);
    await writeIosTheme(
      dependencies.files,
      destination,
      output,
    );
    return destination;
  };
}

async function readIosTemplate(
  files: Pick<FileSystemPort, 'readBytes'>,
  templatePath: string,
) {
  try {
    return await files.readBytes(templatePath);
  } catch (cause) {
    throw normalizeThemeStudioError(cause, {
      code: 'KTB-IOS-EXPORT-TEMPLATE',
      operation: 'theme:export-ios',
      stage: 'iPhone 템플릿 읽기',
      message: 'iPhone 테마 템플릿을 읽지 못했습니다.',
    });
  }
}

async function decodeIosTemplate(source: Uint8Array) {
  try {
    return await decodeArchiveEntries(source);
  } catch (cause) {
    throw normalizeThemeStudioError(cause, {
      code: 'KTB-IOS-EXPORT-TEMPLATE',
      operation: 'theme:export-ios',
      stage: 'iPhone 템플릿 압축 읽기',
      message: 'iPhone 테마 템플릿을 읽지 못했습니다.',
    });
  }
}

function requireIosCss(entries: readonly ArchiveEntry[]) {
  const entry = entries.find(
    (candidate) =>
      !candidate.directory
      && candidate.relativePath === 'KakaoTalkTheme.css',
  );
  if (!entry?.contents) {
    throw new ThemeStudioError({
      code: 'KTB-IOS-EXPORT-TEMPLATE',
      operation: 'theme:export-ios',
      stage: 'iPhone 템플릿 CSS 읽기',
      message: 'iPhone 테마 템플릿 CSS를 읽지 못했습니다.',
    });
  }
  return new TextDecoder().decode(entry.contents);
}

function replaceArchiveEntry(
  entries: readonly ArchiveEntry[],
  relativePath: string,
  contents: Uint8Array,
) {
  return entries.map((entry) =>
    entry.relativePath === relativePath
      ? { ...entry, directory: false, contents }
      : entry);
}

async function writeIosTheme(
  files: Pick<FileSystemPort, 'writeBytes'>,
  destination: string,
  contents: Uint8Array,
) {
  try {
    await files.writeBytes(destination, contents);
  } catch (cause) {
    throw normalizeThemeStudioError(cause, {
      code: 'KTB-FS-WRITE',
      operation: 'theme:export-ios',
      stage: 'iPhone 테마 파일 쓰기',
      message: 'iPhone 테마 파일을 저장하지 못했습니다.',
    });
  }
}
