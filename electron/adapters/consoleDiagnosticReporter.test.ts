import { describe, expect, it, vi } from 'vitest';
import { ThemeStudioError } from '../../src/application/errors/ThemeStudioError';
import { createConsoleDiagnosticReporter } from './consoleDiagnosticReporter';

describe('console diagnostic reporter', () => {
  it('logs structured safe diagnostics and the in-process cause chain', () => {
    const nativeCause = Object.assign(new Error('disk full'), {
      code: 'ENOSPC',
    });
    const cause = new ThemeStudioError({
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '파일 쓰기',
      message: '파일을 저장하지 못했습니다.',
      safeContext: { systemCode: 'ENOSPC' },
      cause: nativeCause,
    });
    const error = new ThemeStudioError({
      code: 'KTB-ANDROID-SIGN',
      operation: 'theme:export-android',
      stage: 'Android APK 서명',
      message: 'Android APK 서명에 실패했습니다.',
      safeContext: { platform: 'android' },
      cause,
    });
    const log = vi.fn();

    createConsoleDiagnosticReporter(log).report(error);

    expect(log).toHaveBeenCalledWith(
      '[KTB-ANDROID-SIGN] Android APK 서명에 실패했습니다.',
      {
        operation: 'theme:export-android',
        stage: 'Android APK 서명',
        safeContext: { platform: 'android' },
        cause,
      },
    );
    expect((log.mock.calls[0]?.[1] as { cause?: unknown }).cause)
      .toBe(cause);
    expect(cause.cause).toBe(nativeCause);
  });
});
