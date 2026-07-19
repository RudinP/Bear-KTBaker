import {
  normalizeThemeStudioError,
} from '../errors/ThemeStudioError';
import type { DialogPort } from '../ports/dialog';
import type { FileSystemPort } from '../ports/fileSystem';
import { parseThemeProject } from '../../domain/theme/codec';
import { mapProjectCodecFailure } from './projectErrorMapping';

export type SaveProject = (
  content: string,
  suggestedName: string,
) => Promise<string | null>;

export function createSaveProject(
  dependencies: {
    dialogs: Pick<DialogPort, 'selectSavePath'>;
    files: Pick<FileSystemPort, 'writeText'>;
  },
): SaveProject {
  return async (content, suggestedName) => {
    try {
      parseThemeProject(content);
    } catch (error) {
      throw mapProjectCodecFailure(error, 'project:save');
    }
    const destination = await dependencies.dialogs.selectSavePath({
      defaultPath: `${suggestedName}.ktstudio`,
      filters: [{
        name: '테마 스튜디오 프로젝트',
        extensions: ['ktstudio'],
      }],
    });
    if (!destination) return null;
    try {
      await dependencies.files.writeText(destination, content);
    } catch (cause) {
      throw normalizeThemeStudioError(cause, {
        code: 'KTB-FS-WRITE',
        operation: 'project:save',
        stage: '프로젝트 파일 쓰기',
        message: '프로젝트 파일을 저장하지 못했습니다.',
      });
    }
    return destination;
  };
}
