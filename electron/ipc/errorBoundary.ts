import {
  normalizeThemeStudioError,
  type ThemeStudioError,
  type ThemeStudioErrorDetails,
} from '../../src/application/errors/ThemeStudioError';
import {
  serializeThemeStudioError,
  type ThemeIpcResult,
} from '../../src/application/errors/ipcPayload';

export type IpcHandler<TArgs extends unknown[], TResult> = (
  event: Electron.IpcMainInvokeEvent,
  ...args: TArgs
) => Promise<TResult> | TResult;

export type ErrorBoundaryFallback = Pick<
  ThemeStudioErrorDetails,
  'code' | 'operation' | 'stage' | 'message'
>;

export function withIpcErrorBoundary<
  TArgs extends unknown[],
  TResult,
>(
  fallback: ErrorBoundaryFallback,
  handler: IpcHandler<TArgs, TResult>,
  report?: (error: ThemeStudioError) => void,
): IpcHandler<TArgs, ThemeIpcResult<TResult>> {
  return async (event, ...args) => {
    try {
      return {
        ok: true,
        value: await handler(event, ...args),
      };
    } catch (error) {
      const typed = normalizeThemeStudioError(error, fallback);
      report?.(typed);
      return {
        ok: false,
        error: serializeThemeStudioError(typed),
      };
    }
  };
}
