import {
  formatThemeStudioSupportString,
} from '../../src/application/errors/supportString';
import {
  normalizeThemeStudioError,
} from '../../src/application/errors/ThemeStudioError';
import type {
  DiagnosticReporter,
} from '../../src/application/ports/diagnostics';
import type {
  SaveScreenshots,
  ScreenshotFile,
} from '../../src/application/screenshots/saveScreenshots';
import type {
  ExportAndroidTheme,
} from '../../src/application/theme/exportAndroidTheme';
import type {
  ExportIosTheme,
} from '../../src/application/theme/exportIosTheme';
import type {
  ImportTheme,
} from '../../src/application/theme/importTheme';
import type {
  SaveProject,
} from '../../src/application/theme/saveProject';
import {
  type ErrorBoundaryFallback,
  type IpcHandler,
  withIpcErrorBoundary,
} from './errorBoundary';
import {
  parseProjectSaveRequest,
  parseScreenshotSaveRequests,
  parseThemeProjectRequest,
} from './requestValidation';
import {
  assertTrustedSender,
  type TrustedSenderPolicy,
} from './trustedSender';
import { THEME_STUDIO_IPC_CHANNELS } from '../../src/shared/themeStudioContract';

export interface ThemeIpcUseCases {
  saveProject: SaveProject;
  importTheme: ImportTheme;
  exportIos: ExportIosTheme;
  exportAndroid: ExportAndroidTheme;
  saveScreenshots: SaveScreenshots;
}

export function registerThemeIpc(dependencies: {
  ipc: Pick<typeof import('electron').ipcMain, 'handle'>;
  senderPolicy: TrustedSenderPolicy;
  useCases: ThemeIpcUseCases;
  diagnostics: DiagnosticReporter;
}): void {
  const register = <TArgs extends unknown[], TResult>(
    channel: string,
    fallback: ErrorBoundaryFallback,
    handler: IpcHandler<TArgs, TResult>,
  ) => {
    dependencies.ipc.handle(
      channel,
      withIpcErrorBoundary<TArgs, TResult>(
        fallback,
        async (event, ...args: TArgs) => {
          assertTrustedSender(event, dependencies.senderPolicy);
          return handler(event, ...args);
        },
        (error) => dependencies.diagnostics.report(error),
      ),
    );
  };

  register(
    THEME_STUDIO_IPC_CHANNELS.saveProject,
    {
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '프로젝트 저장',
      message: '프로젝트를 저장하지 못했습니다.',
    },
    (_event, value: unknown) => {
      const request = parseProjectSaveRequest(value);
      return dependencies.useCases.saveProject(
        request.content,
        request.suggestedName,
      );
    },
  );

  register(
    THEME_STUDIO_IPC_CHANNELS.importTheme,
    unexpectedFallback(THEME_STUDIO_IPC_CHANNELS.importTheme),
    () => dependencies.useCases.importTheme(),
  );

  register(
    THEME_STUDIO_IPC_CHANNELS.exportIos,
    unexpectedFallback(THEME_STUDIO_IPC_CHANNELS.exportIos),
    (_event, value: unknown) =>
      dependencies.useCases.exportIos(parseThemeProjectRequest(value)),
  );

  const androidFallback: ErrorBoundaryFallback = {
    code: 'KTB-UNKNOWN-UNEXPECTED',
    operation: THEME_STUDIO_IPC_CHANNELS.exportAndroid,
    stage: 'Android 테마 내보내기',
    message: 'Android 테마를 내보내지 못했습니다.',
  };
  register(
    THEME_STUDIO_IPC_CHANNELS.exportAndroid,
    androidFallback,
    async (_event, value: unknown) => {
      const project = parseThemeProjectRequest(value);
      try {
        return await dependencies.useCases.exportAndroid(project);
      } catch (error) {
        const typed = normalizeThemeStudioError(error, androidFallback);
        dependencies.diagnostics.report(typed);
        return {
          error: formatThemeStudioSupportString(typed),
        };
      }
    },
  );

  register(
    THEME_STUDIO_IPC_CHANNELS.saveScreenshots,
    unexpectedFallback(THEME_STUDIO_IPC_CHANNELS.saveScreenshots),
    (_event, value: unknown) => {
      const files: readonly ScreenshotFile[] =
        parseScreenshotSaveRequests(value);
      return dependencies.useCases.saveScreenshots(files);
    },
  );
}

function unexpectedFallback(
  operation: ErrorBoundaryFallback['operation'],
): ErrorBoundaryFallback {
  return {
    code: 'KTB-UNKNOWN-UNEXPECTED',
    operation,
    stage: '알 수 없는 작업',
    message: '예상하지 못한 오류가 발생했습니다.',
  };
}
