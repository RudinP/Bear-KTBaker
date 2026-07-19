import { useCallback, useEffect, useRef, useState } from 'react';
import { serializeThemeProject, type ThemeProject } from '../domain/theme';
import {
  THEME_STUDIO_UNAVAILABLE_MESSAGE,
  themeStudioClient,
  type ThemeStudioClient,
} from './themeStudioClient';

export type FileNotice = {
  kind: 'status' | 'error';
  text: string;
};

export interface UseThemeFileCommandsOptions {
  project: ThemeProject;
  replaceProject(next: ThemeProject): void;
  client?: Pick<
    ThemeStudioClient,
    | 'isAvailable'
    | 'importTheme'
    | 'saveProject'
    | 'subscribeFileCommands'
  >;
}

export interface ThemeFileCommandsController {
  fileNotice: FileNotice | null;
  showExport: boolean;
  openTheme(): Promise<void>;
  saveProject(): Promise<void>;
  finishTheme(): void;
  closeExport(): void;
}

function operationErrorText(error: unknown, prefix: string) {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('[KTB-')) return message;
  return `${prefix} ${message || '파일을 확인해 주세요.'}`;
}

export function useThemeFileCommands({
  project,
  replaceProject,
  client = themeStudioClient,
}: UseThemeFileCommandsOptions): ThemeFileCommandsController {
  const [fileNotice, setFileNotice] = useState<FileNotice | null>(null);
  const [showExport, setShowExport] = useState(false);
  const noticeTimer = useRef<number | undefined>(undefined);

  const clearNotice = useCallback(() => {
    if (noticeTimer.current !== undefined) {
      window.clearTimeout(noticeTimer.current);
      noticeTimer.current = undefined;
    }
    setFileNotice(null);
  }, []);
  const setTimedNotice = useCallback((notice: FileNotice) => {
    if (noticeTimer.current !== undefined) {
      window.clearTimeout(noticeTimer.current);
    }
    setFileNotice(notice);
    noticeTimer.current = window.setTimeout(() => {
      setFileNotice(null);
      noticeTimer.current = undefined;
    }, notice.kind === 'status' ? 3_000 : 5_000);
  }, []);

  const openTheme = useCallback(async () => {
    if (!client.isAvailable()) {
      setTimedNotice({ kind: 'error', text: THEME_STUDIO_UNAVAILABLE_MESSAGE });
      return;
    }
    clearNotice();
    try {
      const result = await client.importTheme();
      if (!result) return;
      replaceProject(result.project);
      setTimedNotice({ kind: 'status', text: '테마와 프로젝트 내용을 불러왔습니다.' });
    } catch (error) {
      setTimedNotice({ kind: 'error', text: operationErrorText(error, '불러오지 못했습니다.') });
    }
  }, [clearNotice, client, replaceProject, setTimedNotice]);
  const saveProject = useCallback(async () => {
    if (!client.isAvailable()) {
      setTimedNotice({ kind: 'error', text: THEME_STUDIO_UNAVAILABLE_MESSAGE });
      return;
    }
    clearNotice();
    try {
      const path = await client.saveProject(serializeThemeProject(project), project.meta.name);
      if (path) setTimedNotice({ kind: 'status', text: '프로젝트를 저장했습니다.' });
    } catch (error) {
      setTimedNotice({ kind: 'error', text: operationErrorText(error, '저장하지 못했습니다.') });
    }
  }, [clearNotice, client, project, setTimedNotice]);
  const finishTheme = useCallback(() => setShowExport(true), []);
  const closeExport = useCallback(() => setShowExport(false), []);

  useEffect(() => {
    const unsubscribe = client.subscribeFileCommands((command) => {
      if (command === 'import-theme') void openTheme();
      else if (command === 'save-project') void saveProject();
      else finishTheme();
    });
    return unsubscribe;
  }, [client, finishTheme, openTheme, saveProject]);
  useEffect(() => () => {
    if (noticeTimer.current !== undefined) {
      window.clearTimeout(noticeTimer.current);
    }
  }, []);

  return {
    fileNotice,
    showExport,
    openTheme,
    saveProject,
    finishTheme,
    closeExport,
  };
}
