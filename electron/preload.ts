import { contextBridge, ipcRenderer } from 'electron';
import {
  reconstructThemeStudioError,
  type ThemeIpcResult,
} from '../src/application/errors/ipcPayload';
import { formatThemeStudioSupportString } from '../src/application/errors/supportString';
import type { ThemeStudioApi } from '../src/electron';

async function invokeOrThrow<T>(
  channel: string,
  ...args: unknown[]
): Promise<T> {
  const result = await ipcRenderer.invoke(
    channel,
    ...args,
  ) as ThemeIpcResult<T>;
  if (result.ok) return result.value;
  const reconstructed = reconstructThemeStudioError(result.error);
  throw new Error(formatThemeStudioSupportString(reconstructed));
}

const api: ThemeStudioApi = {
  platform: process.platform,
  openProject: () => invokeOrThrow('project:open'),
  saveProject: (content, suggestedName) => invokeOrThrow(
    'project:save',
    { content, suggestedName },
  ),
  importTheme: () => invokeOrThrow('theme:import'),
  exportIos: (project) => invokeOrThrow('theme:export-ios', project),
  exportAndroid: (project) => invokeOrThrow(
    'theme:export-android',
    project,
  ),
  saveScreenshots: (files) => invokeOrThrow(
    'screenshots:save',
    files,
  ),
  onHistoryCommand: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, command: 'undo' | 'redo') => listener(command);
    ipcRenderer.on('history:command', handler);
    return () => ipcRenderer.removeListener('history:command', handler);
  },
  onFileCommand: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, command: 'import-theme' | 'save-project' | 'finish-theme') => listener(command);
    ipcRenderer.on('file:command', handler);
    return () => ipcRenderer.removeListener('file:command', handler);
  },
};

contextBridge.exposeInMainWorld('themeStudio', api);
