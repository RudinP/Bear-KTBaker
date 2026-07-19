import {
  normalizeThemeStudioError,
} from '../errors/ThemeStudioError';
import type { DialogPort } from '../ports/dialog';
import type { FileSystemPort } from '../ports/fileSystem';

export interface OpenedProject {
  path: string;
  content: string;
}

export type OpenProject = () => Promise<OpenedProject | null>;

export function createOpenProject(
  dependencies: {
    dialogs: Pick<DialogPort, 'selectFile'>;
    files: Pick<FileSystemPort, 'readText'>;
  },
): OpenProject {
  return async () => {
    const selected = await dependencies.dialogs.selectFile({
      title: '테마 스튜디오 프로젝트 열기',
      filters: [{
        name: '테마 스튜디오 프로젝트',
        extensions: ['ktstudio'],
      }],
    });
    if (!selected) return null;
    try {
      return {
        path: selected,
        content: await dependencies.files.readText(selected),
      };
    } catch (cause) {
      throw normalizeThemeStudioError(cause, {
        code: 'KTB-FS-READ',
        operation: 'project:open',
        stage: '프로젝트 파일 읽기',
        message: '프로젝트 파일을 읽지 못했습니다.',
      });
    }
  };
}
