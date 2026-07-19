import { decodeImageDataUrl } from '../../io/imageDataUrl';
import {
  normalizeThemeStudioError,
  ThemeStudioError,
} from '../errors/ThemeStudioError';
import type { DialogPort } from '../ports/dialog';
import type { FileSystemPort, PathPort } from '../ports/fileSystem';

export interface ScreenshotFile {
  name: string;
  dataUrl: string;
}

export type SaveScreenshots = (
  files: readonly ScreenshotFile[],
) => Promise<string | null>;

export function createSaveScreenshots(
  dependencies: {
    dialogs: Pick<DialogPort, 'selectDirectory'>;
    files: Pick<FileSystemPort, 'writeBytes'>;
    paths: Pick<PathPort, 'join' | 'basename' | 'isAbsolute'>;
  },
): SaveScreenshots {
  return async (requestedFiles) => {
    for (const file of requestedFiles) {
      assertSafeScreenshotName(file.name, dependencies.paths);
      assertPngDataUrl(file.dataUrl);
    }
    const directory = await dependencies.dialogs.selectDirectory({
      title: '홍보 이미지 저장 폴더',
      createDirectory: true,
    });
    if (!directory) return null;

    for (const file of requestedFiles) {
      let bytes: Uint8Array;
      try {
        bytes = decodeImageDataUrl(file.dataUrl);
      } catch (cause) {
        throw imageDecodeError('홍보 이미지 데이터를 읽지 못했습니다.', cause);
      }
      try {
        await dependencies.files.writeBytes(
          dependencies.paths.join(directory, file.name),
          bytes,
        );
      } catch (cause) {
        throw normalizeThemeStudioError(cause, {
          code: 'KTB-FS-WRITE',
          operation: 'screenshots:save',
          stage: '홍보 이미지 파일 쓰기',
          message: '홍보 이미지를 저장하지 못했습니다.',
        });
      }
    }
    return directory;
  };
}

function assertSafeScreenshotName(
  name: string,
  paths: Pick<PathPort, 'basename' | 'isAbsolute'>,
) {
  if (
    name.length === 0
    || name === '.'
    || name === '..'
    || name.includes('/')
    || name.includes('\\')
    || paths.isAbsolute(name)
    || paths.basename(name) !== name
  ) {
    throw new ThemeStudioError({
      code: 'KTB-IPC-INVALID-REQUEST',
      operation: 'screenshots:save',
      stage: '홍보 이미지 파일명 검증',
      message: '홍보 이미지 파일명이 올바르지 않습니다.',
    });
  }
}

function assertPngDataUrl(dataUrl: string) {
  const prefix = 'data:image/png;base64,';
  if (!dataUrl.startsWith(prefix)) {
    throw imageDecodeError('홍보 이미지는 PNG 형식이어야 합니다.');
  }
  const encoded = dataUrl.slice(prefix.length);
  if (
    encoded.length === 0
    || encoded.length % 4 !== 0
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
  ) {
    throw imageDecodeError('홍보 이미지 데이터를 읽지 못했습니다.');
  }
}

function imageDecodeError(
  message: string,
  cause?: unknown,
) {
  return new ThemeStudioError({
    code: 'KTB-IMAGE-DECODE',
    operation: 'screenshots:save',
    stage: '홍보 이미지 디코딩',
    message,
    cause,
  });
}
