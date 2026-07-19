import {
  ERROR_CATALOG,
  normalizeErrorCode,
  resolveCatalogDiagnostic,
} from './errorCatalog';
import {
  sanitizeSafeContext,
  type ThemeStudioErrorDetails,
} from './ThemeStudioError';

export function formatThemeStudioSupportString(
  error: Pick<
    ThemeStudioErrorDetails,
    'code' | 'stage' | 'message' | 'safeContext'
  > & Partial<Pick<ThemeStudioErrorDetails, 'operation'>>,
) {
  const code = normalizeErrorCode(error.code);
  const catalog = error.operation
    ? resolveCatalogDiagnostic(code, {
        operation: error.operation,
        stage: error.stage,
        message: error.message,
      })
    : ERROR_CATALOG[code];
  const safeContext = sanitizeSafeContext(error.safeContext);
  const lines = [`[${code}]`, catalog.message, `단계: ${catalog.stage}`];
  if (safeContext?.exitCode !== undefined) {
    const executable = code.includes('AAPT2')
      ? 'aapt2 '
      : '';
    lines.push(
      `원인: ${executable}종료 코드 ${safeContext.exitCode}`,
    );
  }
  if (safeContext?.systemCode !== undefined) {
    lines.push(`원인 코드: ${safeContext.systemCode}`);
  }
  if (safeContext?.signal !== undefined) {
    lines.push(`종료 시그널: ${safeContext.signal}`);
  }
  if (safeContext?.resourceId !== undefined) {
    const key = safeContext.resourceKey === undefined
      ? ''
      : ` (${safeContext.resourceKey})`;
    lines.push(`리소스: ${safeContext.resourceId}${key}`);
  } else if (safeContext?.resourceKey !== undefined) {
    lines.push(`리소스 키: ${safeContext.resourceKey}`);
  }
  if (safeContext?.archiveKind !== undefined) {
    lines.push(`가져오기 형식: ${safeContext.archiveKind}`);
  }
  if (safeContext?.platform !== undefined) {
    lines.push(`플랫폼: ${safeContext.platform}`);
  }
  if (safeContext?.schemaVersion !== undefined) {
    lines.push(`프로젝트 스키마: ${safeContext.schemaVersion}`);
  }
  if (
    safeContext?.expectedCount !== undefined
    || safeContext?.actualCount !== undefined
  ) {
    lines.push(
      `기대/실제 개수: ${
        safeContext.expectedCount ?? '-'
      }/${safeContext.actualCount ?? '-'}`,
    );
  }
  return lines.join('\n');
}
