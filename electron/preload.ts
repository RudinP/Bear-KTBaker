import { contextBridge, ipcRenderer } from 'electron';
import {
  isThemeStudioErrorPayload,
  reconstructThemeStudioError,
} from '../src/application/errors/ipcPayload';
import { ERROR_CATALOG } from '../src/application/errors/errorCatalog';
import { ThemeStudioError } from '../src/application/errors/ThemeStudioError';
import { formatThemeStudioSupportString } from '../src/application/errors/supportString';
import type { ThemeStudioApi } from '../src/electron';

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
