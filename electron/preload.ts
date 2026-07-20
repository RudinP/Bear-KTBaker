import { contextBridge, ipcRenderer } from 'electron';
import {
  isThemeStudioErrorPayload,
  reconstructThemeStudioError,
} from '../src/application/errors/ipcPayload';
import { ERROR_CATALOG } from '../src/application/errors/errorCatalog';
import { ThemeStudioError } from '../src/application/errors/ThemeStudioError';
import { formatThemeStudioSupportString } from '../src/application/errors/supportString';
import type { ThemeStudioApi } from '../src/electron';
import {
  THEME_STUDIO_EVENT_CHANNELS,
  THEME_STUDIO_IPC_CHANNELS,
} from '../src/shared/themeStudioContract';

async function invokeOrThrow<T>(
  channel: string,
  ...args: unknown[]
): Promise<T> {
  let result: unknown;
  try {
    result = await ipcRenderer.invoke(channel, ...args);
  } catch {
    throw bridgeUnavailableError();
  }
  let success: Record<string, unknown> | undefined;
  let failure: Record<string, unknown> | undefined;
  let validFailurePayload = false;
  try {
    success = exactIpcEnvelope(result, ['ok', 'value']);
    failure = exactIpcEnvelope(result, ['ok', 'error']);
    validFailurePayload = failure?.ok === false
      && isThemeStudioErrorPayload(failure.error);
  } catch {
    throw bridgeUnavailableError();
  }
  if (success?.ok === true) return success.value as T;
  if (!failure || !validFailurePayload) {
    throw bridgeUnavailableError();
  }
  const reconstructed = reconstructThemeStudioError(
    failure.error as never,
  );
  throw new Error(formatThemeStudioSupportString(reconstructed));
}

function exactIpcEnvelope(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return undefined;
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length
    || keys.some(
      (key) =>
        typeof key !== 'string'
        || !expectedKeys.includes(key),
    )
  ) {
    return undefined;
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const copy: Record<string, unknown> = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (
      !descriptor
      || !descriptor.enumerable
      || !Object.hasOwn(descriptor, 'value')
    ) {
      return undefined;
    }
    copy[key] = descriptor.value;
  }
  return copy;
}

function bridgeUnavailableError() {
  const diagnostic = ERROR_CATALOG['KTB-IPC-BRIDGE-UNAVAILABLE'];
  return new Error(formatThemeStudioSupportString(new ThemeStudioError({
    code: 'KTB-IPC-BRIDGE-UNAVAILABLE',
    operation: diagnostic.operation,
    stage: diagnostic.stage,
    message: diagnostic.message,
  })));
}

const api: ThemeStudioApi = {
  platform: process.platform,
  saveProject: (content, suggestedName) => invokeOrThrow(
    THEME_STUDIO_IPC_CHANNELS.saveProject,
    { content, suggestedName },
  ),
  importTheme: () => invokeOrThrow(THEME_STUDIO_IPC_CHANNELS.importTheme),
  exportIos: (project) => invokeOrThrow(THEME_STUDIO_IPC_CHANNELS.exportIos, project),
  exportAndroid: (project) => invokeOrThrow(
    THEME_STUDIO_IPC_CHANNELS.exportAndroid,
    project,
  ),
  saveScreenshots: (files) => invokeOrThrow(
    THEME_STUDIO_IPC_CHANNELS.saveScreenshots,
    files,
  ),
  onHistoryCommand: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, command: 'undo' | 'redo') => listener(command);
    ipcRenderer.on(THEME_STUDIO_EVENT_CHANNELS.historyCommand, handler);
    return () => ipcRenderer.removeListener(THEME_STUDIO_EVENT_CHANNELS.historyCommand, handler);
  },
  onFileCommand: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, command: 'import-theme' | 'save-project' | 'finish-theme') => listener(command);
    ipcRenderer.on(THEME_STUDIO_EVENT_CHANNELS.fileCommand, handler);
    return () => ipcRenderer.removeListener(THEME_STUDIO_EVENT_CHANNELS.fileCommand, handler);
  },
};

contextBridge.exposeInMainWorld('themeStudio', api);
