import type { ThemeProject } from "../domain/theme/model";

export const THEME_STUDIO_IPC_CHANNELS = {
  saveProject: "project:save",
  importTheme: "theme:import",
  exportIos: "theme:export-ios",
  exportAndroid: "theme:export-android",
  saveScreenshots: "screenshots:save",
} as const;

export const THEME_STUDIO_EVENT_CHANNELS = {
  historyCommand: "history:command",
  fileCommand: "file:command",
} as const;

export type HistoryCommand = "undo" | "redo";
export type ThemeFileCommand = "import-theme" | "save-project" | "finish-theme";

export interface ThemeImportResult {
  kind: "project" | "ios" | "android";
  project: ThemeProject;
}

export interface AndroidExportResult {
  path?: string;
  error?: string;
}

export interface ScreenshotSaveRequest {
  name: string;
  dataUrl: string;
}

export interface ThemeStudioApi {
  platform: NodeJS.Platform;
  saveProject(content: string, suggestedName: string): Promise<string | null>;
  importTheme(): Promise<ThemeImportResult | null>;
  exportIos(project: ThemeProject): Promise<string | null>;
  exportAndroid(project: ThemeProject): Promise<AndroidExportResult | null>;
  saveScreenshots(files: ScreenshotSaveRequest[]): Promise<string | null>;
  onHistoryCommand?: (
    listener: (command: HistoryCommand) => void,
  ) => () => void;
  onFileCommand?: (listener: (command: ThemeFileCommand) => void) => () => void;
}
