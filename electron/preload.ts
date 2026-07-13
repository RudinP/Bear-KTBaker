import { contextBridge, ipcRenderer } from 'electron';
import type { ThemeStudioApi } from '../src/electron';

const api: ThemeStudioApi = {
  platform: process.platform,
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (content, suggestedName) => ipcRenderer.invoke('project:save', { content, suggestedName }),
  importTheme: () => ipcRenderer.invoke('theme:import'),
  exportIos: (project) => ipcRenderer.invoke('theme:export-ios', project),
  exportAndroid: (project) => ipcRenderer.invoke('theme:export-android', project),
  saveScreenshots: (files) => ipcRenderer.invoke('screenshots:save', files),
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
