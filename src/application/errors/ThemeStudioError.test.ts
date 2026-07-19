import { describe, expect, it } from 'vitest';
import {
  normalizeThemeStudioError,
  systemErrorContext,
  ThemeStudioError,
} from './ThemeStudioError';
import { formatThemeStudioSupportString } from './supportString';

describe('ThemeStudioError', () => {
  it('keeps the native cause in process and formats stable support text', () => {
    const error = new ThemeStudioError({
      code: 'KTB-ANDROID-AAPT2-COMPILE',
      operation: 'theme:export-android',
      stage: 'APK 리소스 컴파일',
      message: 'Android 리소스 컴파일에 실패했습니다.',
      safeContext: { exitCode: 1 },
      cause: new Error('aapt2 exit 1'),
    });

    expect(error.cause).toBeInstanceOf(Error);
    expect(formatThemeStudioSupportString(error)).toBe([
      '[KTB-ANDROID-AAPT2-COMPILE]',
      'Android 리소스 컴파일에 실패했습니다.',
      '단계: APK 리소스 컴파일',
      '원인: aapt2 종료 코드 1',
    ].join('\n'));
  });

  it('returns an existing ThemeStudioError unchanged', () => {
    const error = new ThemeStudioError({
      code: 'KTB-ANDROID-AAPT2-COMPILE',
      operation: 'theme:export-android',
      stage: 'APK 리소스 컴파일',
      message: 'Android 리소스 컴파일에 실패했습니다.',
    });

    const normalized = normalizeThemeStudioError(error, {
      code: 'KTB-UNKNOWN-UNEXPECTED',
      operation: 'ipc:validate',
      stage: '알 수 없는 작업',
      message: '예상하지 못한 오류가 발생했습니다.',
    });

    expect(normalized).toBe(error);
  });

  it('adds a valid system error code to file-system failures', () => {
    const nativeError = Object.assign(new Error('disk full'), {
      code: 'ENOSPC',
    });
    const fileFailure = normalizeThemeStudioError(nativeError, {
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '프로젝트 파일 쓰기',
      message: '프로젝트를 저장하지 못했습니다.',
    });

    expect(fileFailure.cause).toBe(nativeError);
    expect(fileFailure.safeContext).toEqual({
      systemCode: 'ENOSPC',
    });
    expect(formatThemeStudioSupportString(fileFailure))
      .toContain('원인 코드: ENOSPC');
  });

  it('rejects unsafe system error codes', () => {
    expect(systemErrorContext({ code: 'ENOENT; /Users/person/private' }))
      .toBeUndefined();
    expect(systemErrorContext({ code: 13 })).toBeUndefined();
    expect(systemErrorContext(null)).toBeUndefined();
  });

  it('formats resource identifiers without exposing other context', () => {
    const supportString = formatThemeStudioSupportString(
      new ThemeStudioError({
        code: 'KTB-ANDROID-IMAGE-RECOVERY',
        operation: 'theme:import',
        stage: 'Android 이미지 복원',
        message: 'Android 이미지 리소스를 복원하지 못했습니다.',
        safeContext: {
          resourceId: 'main.tab.background',
          resourceKey: 'drawable/theme_maintab_cell_image',
        },
      }),
    );

    expect(supportString).toContain(
      '리소스: main.tab.background '
      + '(drawable/theme_maintab_cell_image)',
    );
  });
});
