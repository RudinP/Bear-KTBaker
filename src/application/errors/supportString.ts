import type { ThemeStudioErrorDetails } from './ThemeStudioError';

export function formatThemeStudioSupportString(
  error: Pick<
    ThemeStudioErrorDetails,
    'code' | 'stage' | 'message' | 'safeContext'
  >,
) {
  const lines = [`[${error.code}]`, error.message, `단계: ${error.stage}`];
  if (error.safeContext?.exitCode !== undefined) {
    const executable = error.code.includes('AAPT2')
      ? 'aapt2 '
      : '';
    lines.push(
      `원인: ${executable}종료 코드 ${error.safeContext.exitCode}`,
    );
  }
  if (error.safeContext?.systemCode !== undefined) {
    lines.push(`원인 코드: ${error.safeContext.systemCode}`);
  }
  if (error.safeContext?.signal !== undefined) {
    lines.push(`종료 시그널: ${error.safeContext.signal}`);
  }
  if (error.safeContext?.resourceId !== undefined) {
    const key = error.safeContext.resourceKey === undefined
      ? ''
      : ` (${error.safeContext.resourceKey})`;
    lines.push(`리소스: ${error.safeContext.resourceId}${key}`);
  } else if (error.safeContext?.resourceKey !== undefined) {
    lines.push(`리소스 키: ${error.safeContext.resourceKey}`);
  }
  if (error.safeContext?.archiveKind !== undefined) {
    lines.push(`가져오기 형식: ${error.safeContext.archiveKind}`);
  }
  if (error.safeContext?.platform !== undefined) {
    lines.push(`플랫폼: ${error.safeContext.platform}`);
  }
  if (error.safeContext?.schemaVersion !== undefined) {
    lines.push(`프로젝트 스키마: ${error.safeContext.schemaVersion}`);
  }
  if (
    error.safeContext?.expectedCount !== undefined
    || error.safeContext?.actualCount !== undefined
  ) {
    lines.push(
      `기대/실제 개수: ${
        error.safeContext.expectedCount ?? '-'
      }/${error.safeContext.actualCount ?? '-'}`,
    );
  }
  return lines.join('\n');
}
