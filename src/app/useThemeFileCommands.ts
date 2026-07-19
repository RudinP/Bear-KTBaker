import { useCallback, useEffect, useRef, useState } from 'react';
import { rendererOperationErrorText } from '../application/errors/rendererOperationErrorText';
import { serializeThemeProject, type ThemeProject } from '../domain/theme';
import {
  THEME_STUDIO_UNAVAILABLE_MESSAGE,
  themeStudioClient,
  type ThemeFileCommand,
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

export function useThemeFileCommands({
  project,
  replaceProject,
  client = themeStudioClient,
}: UseThemeFileCommandsOptions): ThemeFileCommandsController {
  const [fileNotice, setFileNotice] = useState<FileNotice | null>(null);
  const [showExport, setShowExport] = useState(false);
  const noticeTimer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);
  const operationGeneration = useRef(0);
  const projectRef = useRef(project);
  const replaceProjectRef = useRef(replaceProject);
  const clientRef = useRef(client);
  projectRef.current = project;
  replaceProjectRef.current = replaceProject;
  clientRef.current = client;

  const clearNotice = useCallback(() => {
    if (!mounted.current) return;
    if (noticeTimer.current !== undefined) {
      window.clearTimeout(noticeTimer.current);
      noticeTimer.current = undefined;
    }
    setFileNotice(null);
  }, []);
  const setTimedNotice = useCallback((notice: FileNotice) => {
    if (!mounted.current) return;
    if (noticeTimer.current !== undefined) {
      window.clearTimeout(noticeTimer.current);
    }
    setFileNotice(notice);
    noticeTimer.current = window.setTimeout(() => {
      if (!mounted.current) return;
      setFileNotice(null);
      noticeTimer.current = undefined;
    }, notice.kind === 'status' ? 3_000 : 5_000);
  }, []);

  const openTheme = useCallback(async () => {
    const generation = ++operationGeneration.current;
    const isCurrent = () => mounted.current && operationGeneration.current === generation;
    const currentClient = clientRef.current;
    if (!currentClient.isAvailable()) {
      if (!isCurrent()) return;
      setTimedNotice({ kind: 'error', text: THEME_STUDIO_UNAVAILABLE_MESSAGE });
      return;
    }
    clearNotice();
    try {
      const result = await currentClient.importTheme();
      if (!isCurrent() || !result) return;
      replaceProjectRef.current(result.project);
      setTimedNotice({ kind: 'status', text: '테마와 프로젝트 내용을 불러왔습니다.' });
    } catch (error) {
      if (!isCurrent()) return;
      setTimedNotice({
        kind: 'error',
        text: rendererOperationErrorText(error, '불러오지 못했습니다.', '파일을 확인해 주세요.'),
      });
    }
  }, [clearNotice, setTimedNotice]);
  const saveProject = useCallback(async () => {
    const generation = ++operationGeneration.current;
    const isCurrent = () => mounted.current && operationGeneration.current === generation;
    const currentClient = clientRef.current;
    if (!currentClient.isAvailable()) {
      if (!isCurrent()) return;
      setTimedNotice({ kind: 'error', text: THEME_STUDIO_UNAVAILABLE_MESSAGE });
      return;
    }
    clearNotice();
    try {
      const currentProject = projectRef.current;
      const path = await currentClient.saveProject(
        serializeThemeProject(currentProject),
        currentProject.meta.name,
      );
      if (isCurrent() && path) setTimedNotice({ kind: 'status', text: '프로젝트를 저장했습니다.' });
    } catch (error) {
      if (!isCurrent()) return;
      setTimedNotice({
        kind: 'error',
        text: rendererOperationErrorText(error, '저장하지 못했습니다.', '저장 위치를 확인해 주세요.'),
      });
    }
  }, [clearNotice, setTimedNotice]);
  const finishTheme = useCallback(() => {
    if (mounted.current) setShowExport(true);
  }, []);
  const closeExport = useCallback(() => {
    if (mounted.current) setShowExport(false);
  }, []);
  const commandHandler = useRef<(command: ThemeFileCommand) => void>(() => undefined);
  commandHandler.current = (command) => {
    if (command === 'import-theme') void openTheme();
    else if (command === 'save-project') void saveProject();
    else finishTheme();
  };

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = client.subscribeFileCommands((command) => commandHandler.current(command));
    return unsubscribe;
  }, [client]);
  useEffect(() => () => {
    mounted.current = false;
    operationGeneration.current += 1;
    if (noticeTimer.current !== undefined) {
      window.clearTimeout(noticeTimer.current);
      noticeTimer.current = undefined;
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
