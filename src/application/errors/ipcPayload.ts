import {
  ERROR_CATALOG,
  type ErrorCode,
  type ThemeOperation,
} from './errorCatalog';
import {
  SAFE_CONTEXT_KEYS,
  sanitizeSafeContext,
  ThemeStudioError,
} from './ThemeStudioError';

export interface ThemeStudioErrorPayload {
  name: 'ThemeStudioError';
  code: ErrorCode;
  operation: ThemeOperation;
  stage: string;
  message: string;
  safeContext?: Record<string, string | number | boolean>;
  cause?: ThemeStudioErrorPayload;
}

export type ThemeIpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ThemeStudioErrorPayload };

export function serializeThemeStudioError(
  error: ThemeStudioError,
): ThemeStudioErrorPayload {
  return {
    name: 'ThemeStudioError',
    code: error.code,
    operation: error.operation,
    stage: error.stage,
    message: error.message,
    ...(error.safeContext
      ? { safeContext: sanitizeSafeContext(error.safeContext) }
      : {}),
    ...(error.cause instanceof ThemeStudioError
      ? { cause: serializeThemeStudioError(error.cause) }
      : {}),
  };
}

export function isThemeStudioErrorPayload(
  value: unknown,
): value is ThemeStudioErrorPayload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ThemeStudioErrorPayload>;
  return candidate.name === 'ThemeStudioError'
    && typeof candidate.code === 'string'
    && candidate.code in ERROR_CATALOG
    && typeof candidate.operation === 'string'
    && THEME_OPERATIONS.has(
      candidate.operation as ThemeOperation,
    )
    && typeof candidate.stage === 'string'
    && typeof candidate.message === 'string'
    && (
      candidate.safeContext === undefined
      || isSerializedSafeContext(candidate.safeContext)
    )
    && (
      candidate.cause === undefined
      || isThemeStudioErrorPayload(candidate.cause)
    );
}

const THEME_OPERATIONS = new Set<ThemeOperation>([
  'project:open',
  'project:save',
  'theme:import',
  'theme:export-ios',
  'theme:export-android',
  'screenshots:save',
  'ipc:validate',
]);

function isSerializedSafeContext(value: unknown) {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.entries(value).every(
      ([key, item]) =>
        SAFE_CONTEXT_KEYS.has(key)
        && (
          typeof item === 'string'
          || typeof item === 'number'
          || typeof item === 'boolean'
        ),
    ),
  );
}

export function reconstructThemeStudioError(
  payload: ThemeStudioErrorPayload,
): ThemeStudioError {
  if (!isThemeStudioErrorPayload(payload)) {
    return new ThemeStudioError({
      code: 'KTB-UNKNOWN-UNEXPECTED',
      operation: 'ipc:validate',
      stage: '오류 응답 검증',
      message: '앱 오류 응답을 읽지 못했습니다.',
    });
  }
  return new ThemeStudioError({
    code: payload.code,
    operation: payload.operation,
    stage: payload.stage,
    message: payload.message,
    safeContext: payload.safeContext,
    cause: payload.cause
      ? reconstructThemeStudioError(payload.cause)
      : undefined,
  });
}
