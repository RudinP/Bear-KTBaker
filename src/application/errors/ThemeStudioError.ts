import type { ErrorCode, ThemeOperation } from './errorCatalog';

export interface ThemeStudioErrorDetails {
  code: ErrorCode;
  operation: ThemeOperation;
  stage: string;
  message: string;
  safeContext?: Record<string, string | number | boolean>;
  cause?: unknown;
}

export const SAFE_CONTEXT_KEYS = new Set([
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
]);

export class ThemeStudioError extends Error {
  readonly code: ErrorCode;
  readonly operation: ThemeOperation;
  readonly stage: string;
  readonly safeContext?: Record<string, string | number | boolean>;

  constructor(details: ThemeStudioErrorDetails) {
    super(details.message, { cause: details.cause });
    this.name = 'ThemeStudioError';
    this.code = details.code;
    this.operation = details.operation;
    this.stage = details.stage;
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
  if (!context) return undefined;
  const safe = Object.fromEntries(
    Object.entries(context).filter(
      ([key, value]) =>
        SAFE_CONTEXT_KEYS.has(key)
        && (
          typeof value === 'string'
          || typeof value === 'number'
          || typeof value === 'boolean'
        ),
    ),
  ) as Record<string, string | number | boolean>;
  return Object.keys(safe).length === 0 ? undefined : safe;
}
