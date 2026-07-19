import {
  ERROR_CATALOG,
  type ErrorCode,
  type ThemeOperation,
} from './errorCatalog';

export interface ThemeStudioErrorDetails {
  code: ErrorCode;
  operation: ThemeOperation;
  stage: string;
  message: string;
  safeContext?: Record<string, string | number | boolean>;
  cause?: unknown;
}

const SAFE_CONTEXT_KEYS = Object.freeze([
  'archiveKind',
  'resourceId',
  'resourceKey',
  'stage',
  'exitCode',
  'signal',
  'systemCode',
  'platform',
  'schemaVersion',
  'expectedCount',
  'actualCount',
] as const);

const SAFE_ARCHIVE_KINDS = new Set(['ios', 'source', 'apk']);
const SAFE_PLATFORMS = new Set(['ios', 'android', 'darwin', 'win32']);
const MAX_DIAGNOSTIC_TEXT_LENGTH = 256;
const MAX_RESOURCE_IDENTIFIER_LENGTH = 160;
const MAX_SYSTEM_TOKEN_LENGTH = 64;
const RESOURCE_IDENTIFIER_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
const SYSTEM_TOKEN_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const ABSOLUTE_PATH_PATTERN =
  /(?:^|[\s"'=(])(?:\/[A-Za-z0-9._-]+|[A-Za-z]:[\\/]|\\\\)/;
const DATA_URL_PATTERN = /\bdata:[a-z0-9.+/-]+(?:;[^,\s]*)?,/i;
const SENSITIVE_TEXT_PATTERN =
  /(?:^|[^A-Za-z0-9])(?:base64|password|passwd|token|secret|credential|private|api[_ -]?key|keystore|signing[_ -]?(?:key|material|identity))(?=$|[^A-Za-z0-9])/i;
const THEME_CONTENT_PATTERN =
  /(?:[{}\[\]]|<\?xml|<\/?[A-Za-z]|@charset|KakaoTalkTheme|(?:^|\s)-ios-)/i;

export class ThemeStudioError extends Error {
  readonly code: ErrorCode;
  readonly operation: ThemeOperation;
  readonly stage: string;
  readonly safeContext?: Record<string, string | number | boolean>;

  constructor(details: ThemeStudioErrorDetails) {
    const catalog = ERROR_CATALOG[details.code];
    const message = isSafeDiagnosticText(details.message)
      ? details.message
      : catalog.message;
    super(message, { cause: details.cause });
    this.name = 'ThemeStudioError';
    this.code = details.code;
    this.operation = details.operation;
    this.stage = isSafeDiagnosticText(details.stage)
      ? details.stage
      : catalog.stage;
    this.safeContext = sanitizeSafeContext(details.safeContext);
  }
}

export function normalizeThemeStudioError(
  error: unknown,
  fallback: Omit<ThemeStudioErrorDetails, 'cause'>,
): ThemeStudioError {
  if (error instanceof ThemeStudioError) return error;
  const safeContext = fallback.code.startsWith('KTB-FS-')
    ? {
        ...fallback.safeContext,
        ...systemErrorContext(error),
      }
    : fallback.safeContext;
  return new ThemeStudioError({
    ...fallback,
    safeContext,
    cause: error,
  });
}

export function systemErrorContext(
  error: unknown,
): Record<string, string> | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string'
    && /^[A-Z][A-Z0-9_]+$/.test(code)
    ? { systemCode: code }
    : undefined;
}

export function sanitizeSafeContext(
  context: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> | undefined {
  if (!isPlainRecord(context)) return undefined;
  const safe = Object.fromEntries(
    SAFE_CONTEXT_KEYS.flatMap(
      (key) => Object.hasOwn(context, key)
        && isSafeContextValue(key, context[key])
        ? [[key, context[key]]]
        : [],
    ),
  ) as Record<string, string | number | boolean>;
  return Object.keys(safe).length === 0 ? undefined : safe;
}

export function isSafeContext(
  value: unknown,
): value is Record<string, string | number | boolean> {
  if (!isPlainRecord(value)) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length > 0
    && keys.every(
      (key) =>
        typeof key === 'string'
        && isSafeContextKey(key)
        && isSafeContextValue(key, value[key]),
    );
}

export function isSafeDiagnosticText(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_DIAGNOSTIC_TEXT_LENGTH
    && value.trim() === value
    && !/[\u0000-\u001f\u007f]/.test(value)
    && !ABSOLUTE_PATH_PATTERN.test(value)
    && !DATA_URL_PATTERN.test(value)
    && !SENSITIVE_TEXT_PATTERN.test(value)
    && !THEME_CONTENT_PATTERN.test(value);
}

function isSafeContextKey(
  key: string,
): key is (typeof SAFE_CONTEXT_KEYS)[number] {
  return (SAFE_CONTEXT_KEYS as readonly string[]).includes(key);
}

function isSafeContextValue(
  key: (typeof SAFE_CONTEXT_KEYS)[number],
  value: unknown,
) {
  switch (key) {
    case 'archiveKind':
      return typeof value === 'string' && SAFE_ARCHIVE_KINDS.has(value);
    case 'resourceId':
    case 'resourceKey':
      return isSafeResourceIdentifier(value);
    case 'stage':
      return isSafeDiagnosticText(value);
    case 'exitCode':
      return typeof value === 'number'
        && Number.isFinite(value)
        && Number.isInteger(value);
    case 'signal':
    case 'systemCode':
      return typeof value === 'string'
        && value.length > 0
        && value.length <= MAX_SYSTEM_TOKEN_LENGTH
        && SYSTEM_TOKEN_PATTERN.test(value)
        && !SENSITIVE_TEXT_PATTERN.test(value);
    case 'platform':
      return typeof value === 'string' && SAFE_PLATFORMS.has(value);
    case 'schemaVersion':
    case 'expectedCount':
    case 'actualCount':
      return typeof value === 'number'
        && Number.isFinite(value)
        && Number.isInteger(value)
        && value >= 0;
  }
}

function isSafeResourceIdentifier(value: unknown) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_RESOURCE_IDENTIFIER_LENGTH
    && RESOURCE_IDENTIFIER_PATTERN.test(value)
    && value.split('/').every((segment) => segment !== '.' && segment !== '..')
    && !SENSITIVE_TEXT_PATTERN.test(value);
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
