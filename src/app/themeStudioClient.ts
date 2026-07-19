import type { ThemeProject } from '../domain/theme/model';
import type { ThemeStudioApi } from '../electron';

export type HistoryCommand = 'undo' | 'redo';
export type ThemeFileCommand =
  | 'import-theme'
  | 'save-project'
  | 'finish-theme';

export type ThemeImportResult = {
  kind: 'project' | 'ios' | 'android';
  project: ThemeProject;
};

export const THEME_STUDIO_UNAVAILABLE_MESSAGE = [
  '[KTB-IPC-BRIDGE-UNAVAILABLE]',
  'Electron 앱 기능에 연결하지 못했습니다.',
  '단계: 렌더러 브리지 연결',
].join('\n');

export interface ThemeStudioClient {
  readonly platform: NodeJS.Platform | undefined;
  isAvailable(): boolean;
  importTheme(): Promise<ThemeImportResult | null>;
  saveProject(content: string, suggestedName: string): Promise<string | null>;
  exportIos(project: ThemeProject): Promise<string | null>;
  exportAndroid(
    project: ThemeProject,
  ): Promise<{ path?: string; error?: string } | null>;
  saveScreenshots(
    files: Array<{ name: string; dataUrl: string }>,
  ): Promise<string | null>;
  subscribeHistoryCommands(
    listener: (command: HistoryCommand) => void,
  ): () => void;
  subscribeFileCommands(
    listener: (command: ThemeFileCommand) => void,
  ): () => void;
}

export function createThemeStudioClient(
  resolveApi: () => ThemeStudioApi | undefined = () =>
    typeof window === 'undefined' ? undefined : window.themeStudio,
): ThemeStudioClient {
  const required = () => {
    const api = resolveApi();
    if (!api) {
      throw new Error(THEME_STUDIO_UNAVAILABLE_MESSAGE);
    }
    return api;
  };

  return {
    get platform() {
      return resolveApi()?.platform;
    },
    isAvailable: () => Boolean(resolveApi()),
    importTheme: () => required().importTheme(),
    saveProject: (content, suggestedName) =>
      required().saveProject(content, suggestedName),
    exportIos: (project) => required().exportIos(project),
    exportAndroid: (project) => required().exportAndroid(project),
    saveScreenshots: (files) => required().saveScreenshots(files),
    subscribeHistoryCommands: (listener) =>
      resolveApi()?.onHistoryCommand?.(listener) ?? (() => undefined),
    subscribeFileCommands: (listener) =>
      resolveApi()?.onFileCommand?.(listener) ?? (() => undefined),
  };
}

export const themeStudioClient = createThemeStudioClient();
