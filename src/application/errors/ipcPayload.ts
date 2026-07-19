import {
  type ErrorCode,
  isCatalogDiagnostic,
  isErrorCode,
  normalizeErrorCode,
  resolveCatalogDiagnostic,
  type ThemeOperation,
} from './errorCatalog';
import {
  isSafeContext,
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

// The root error counts as depth one; at most eight structured errors cross IPC.
const MAX_STRUCTURED_ERROR_DEPTH = 8;
const PAYLOAD_KEYS = Object.freeze([
  'name',
  'code',
  'operation',
  'stage',
  'message',
  'safeContext',
  'cause',
] as const);
const REQUIRED_PAYLOAD_KEYS = Object.freeze([
  'name',
  'code',
  'operation',
  'stage',
  'message',
] as const);

export function serializeThemeStudioError(
  error: ThemeStudioError,
): ThemeStudioErrorPayload {
  return serializeThemeStudioErrorInternal(error, new WeakSet(), 1);
}

function serializeThemeStudioErrorInternal(
  error: ThemeStudioError,
  seen: WeakSet<ThemeStudioError>,
  depth: number,
): ThemeStudioErrorPayload {
  seen.add(error);
  const code = normalizeErrorCode(error.code);
  const catalog = resolveCatalogDiagnostic(code, {
    operation: error.operation,
    stage: error.stage,
    message: error.message,
  });
  const safeContext = sanitizeSafeContext(error.safeContext);
  const nestedCause = error.cause instanceof ThemeStudioError
    && depth < MAX_STRUCTURED_ERROR_DEPTH
    && !seen.has(error.cause)
    ? serializeThemeStudioErrorInternal(error.cause, seen, depth + 1)
    : undefined;
  return {
    name: 'ThemeStudioError',
    code,
    operation: catalog.operation,
    stage: catalog.stage,
    message: catalog.message,
    ...(safeContext ? { safeContext } : {}),
    ...(nestedCause ? { cause: nestedCause } : {}),
  };
}

export function isThemeStudioErrorPayload(
  value: unknown,
): value is ThemeStudioErrorPayload {
  return isThemeStudioErrorPayloadInternal(value, new WeakSet(), 1);
}

function isThemeStudioErrorPayloadInternal(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
): value is ThemeStudioErrorPayload {
  if (
    depth > MAX_STRUCTURED_ERROR_DEPTH
    || !isPlainRecord(value)
    || seen.has(value)
    || !hasExactPayloadKeys(value)
  ) {
    return false;
  }
  seen.add(value);
  if (value.name !== 'ThemeStudioError' || !isErrorCode(value.code)) {
    return false;
  }
  return typeof value.operation === 'string'
    && typeof value.stage === 'string'
    && typeof value.message === 'string'
    && isCatalogDiagnostic(value.code, {
      operation: value.operation as ThemeOperation,
      stage: value.stage,
      message: value.message,
    })
    && (
      !Object.hasOwn(value, 'safeContext')
      || value.safeContext === undefined
      || isSafeContext(value.safeContext)
    )
    && (
      !Object.hasOwn(value, 'cause')
      || value.cause === undefined
      || isThemeStudioErrorPayloadInternal(
        value.cause,
        seen,
        depth + 1,
      )
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
  return reconstructValidatedThemeStudioError(payload);
}

function reconstructValidatedThemeStudioError(
  payload: ThemeStudioErrorPayload,
): ThemeStudioError {
  return new ThemeStudioError({
    code: payload.code,
    operation: payload.operation,
    stage: payload.stage,
    message: payload.message,
    safeContext: payload.safeContext,
    cause: payload.cause
      ? reconstructValidatedThemeStudioError(payload.cause)
      : undefined,
  });
}

function hasExactPayloadKeys(
  value: Record<string, unknown>,
) {
  const keys = Reflect.ownKeys(value);
  return REQUIRED_PAYLOAD_KEYS.every((key) => Object.hasOwn(value, key))
    && keys.every(
      (key) =>
        typeof key === 'string'
        && (PAYLOAD_KEYS as readonly string[]).includes(key),
    );
}

function isPlainRecord(
  value: unknown,
): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
