import type { ThemeProject } from './domain/theme';

export interface ThemeStudioApi {
  platform: NodeJS.Platform;
  openProject: () => Promise<{ path: string; content: string } | null>;
  saveProject: (content: string, suggestedName: string) => Promise<string | null>;
  importTheme: () => Promise<{ kind: 'project' | 'ios' | 'android'; project: ThemeProject } | null>;
  exportIos: (project: ThemeProject) => Promise<string | null>;
  exportAndroid: (project: ThemeProject) => Promise<{ path?: string; error?: string } | null>;
  saveScreenshots: (files: Array<{ name: string; dataUrl: string }>) => Promise<string | null>;
  onHistoryCommand?: (listener: (command: 'undo' | 'redo') => void) => () => void;
  onFileCommand?: (listener: (command: 'import-theme' | 'save-project' | 'finish-theme') => void) => () => void;
}

declare global {
  interface Window { themeStudio?: ThemeStudioApi }
}

export {};
