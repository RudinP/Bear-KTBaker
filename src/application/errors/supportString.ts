import {
  ERROR_CATALOG,
  normalizeErrorCode,
  resolveCatalogDiagnostic,
} from './errorCatalog';
import {
  sanitizeSafeContext,
  type ThemeStudioErrorDetails,
} from './ThemeStudioError';

const TOOL_REASON_MESSAGES = {
  'non-ascii-path': '경로에 한글 등 특수 문자가 포함되어 있어요 (임시 폴더 경로를 영문으로 바꾼 뒤 다시 시도해 주세요)',
  'path-too-long': '경로가 너무 길어요 (설치 위치를 더 짧은 경로로 옮긴 뒤 다시 시도해 주세요)',
  'permission-denied': '해당 경로에 접근 권한이 없어요',
  'missing-file': '필요한 파일을 찾지 못했어요',
  unknown: '알 수 없는 도구 오류예요',
} as const;

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
  if (safeContext?.toolReason !== undefined) {
    lines.push(
      `원인 분류: ${TOOL_REASON_MESSAGES[
        safeContext.toolReason as keyof typeof TOOL_REASON_MESSAGES
      ] ?? safeContext.toolReason}`,
    );
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
