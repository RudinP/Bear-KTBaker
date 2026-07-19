import { describe, expect, it } from 'vitest';
import * as themeStudioErrorModule from './ThemeStudioError';
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

  it('keeps the raw safe-context key collection private', () => {
    expect(themeStudioErrorModule).not.toHaveProperty('SAFE_CONTEXT_KEYS');
  });

  it('keeps valid per-key diagnostic context values', () => {
    const error = new ThemeStudioError({
      code: 'KTB-ANDROID-IMAGE-RECOVERY',
      operation: 'theme:import',
      stage: 'Android 이미지 복원',
      message: 'Android 이미지 리소스를 복원하지 못했습니다.',
      safeContext: {
        archiveKind: 'apk',
        resourceId: 'main.tab.background',
        resourceKey: 'drawable/theme_maintab_cell_image',
        exitCode: -1,
        signal: 'SIGTERM',
        systemCode: 'ENOSPC',
        platform: 'android',
        schemaVersion: 1,
        expectedCount: 10,
        actualCount: 9,
      },
    });

    expect(error.safeContext).toEqual({
      archiveKind: 'apk',
      resourceId: 'main.tab.background',
      resourceKey: 'drawable/theme_maintab_cell_image',
      exitCode: -1,
      signal: 'SIGTERM',
      systemCode: 'ENOSPC',
      platform: 'android',
      schemaVersion: 1,
      expectedCount: 10,
      actualCount: 9,
    });
  });

  it('drops unsafe values even when their context keys are allowlisted', () => {
    const error = new ThemeStudioError({
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '프로젝트 파일 쓰기',
      message: '프로젝트를 저장하지 못했습니다.',
      safeContext: {
        archiveKind: 'data:image/png;base64,secret',
        resourceId: '/Users/person/private.ktstudio',
        resourceKey: 'drawable/password=secret',
        stage: '{"theme":{"contents":"private"}}',
        exitCode: Number.POSITIVE_INFINITY,
        signal: 'TOKEN=secret',
        systemCode: '-----BEGIN PRIVATE KEY-----',
        platform: 'win32 C:\\private\\signing.keystore',
        schemaVersion: -1,
        expectedCount: 1.5,
        actualCount: 2,
        extra: 'ignored',
      },
    });

    expect(error.safeContext).toEqual({ actualCount: 2 });
    expect(JSON.stringify(error.safeContext)).not.toMatch(
      /Users|data:|base64|theme|password|token|private|signing|secret/i,
    );
  });

  it('enforces context value bounds and sensitive-token rejection', () => {
    const error = new ThemeStudioError({
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '프로젝트 파일 쓰기',
      message: '프로젝트를 저장하지 못했습니다.',
      safeContext: {
        resourceId: `main.${'a'.repeat(160)}`,
        resourceKey: 'drawable/private_key',
        stage: '가'.repeat(257),
        signal: 'PASSWORD_HASH',
        systemCode: 'TOKEN_VALUE',
      },
    });

    expect(error.safeContext).toBeUndefined();
  });

  it('omits arbitrary context stages because no consumer has a registry for them', () => {
    const error = new ThemeStudioError({
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '프로젝트 파일 쓰기',
      message: '프로젝트를 저장하지 못했습니다.',
      safeContext: { stage: '이미지 복원 단계' },
    });

    expect(error.safeContext).toBeUndefined();
  });

  it('keeps only registry-backed resource identifiers and Android keys', () => {
    const valid = new ThemeStudioError({
      code: 'KTB-ANDROID-IMAGE-RECOVERY',
      operation: 'theme:import',
      stage: 'Android 이미지 복원',
      message: 'Android 이미지 리소스를 복원하지 못했습니다.',
      safeContext: {
        resourceId: 'main.tab.background',
        resourceKey: 'drawable/theme_maintab_cell_image',
      },
    });
    const colorsAndIcons = new ThemeStudioError({
      code: 'KTB-ANDROID-IMAGE-RECOVERY',
      operation: 'theme:import',
      stage: 'Android 이미지 복원',
      message: 'Android 이미지 리소스를 복원하지 못했습니다.',
      safeContext: {
        resourceId: 'common.theme-icon',
        resourceKey: 'mipmap/ic_launcher',
      },
    });
    const color = new ThemeStudioError({
      code: 'KTB-ANDROID-IMAGE-RECOVERY',
      operation: 'theme:import',
      stage: 'Android 이미지 복원',
      message: 'Android 이미지 리소스를 복원하지 못했습니다.',
      safeContext: { resourceKey: 'color/theme_background_color' },
    });

    expect(valid.safeContext).toEqual({
      resourceId: 'main.tab.background',
      resourceKey: 'drawable/theme_maintab_cell_image',
    });
    expect(colorsAndIcons.safeContext).toEqual({
      resourceId: 'common.theme-icon',
      resourceKey: 'mipmap/ic_launcher',
    });
    expect(color.safeContext).toEqual({
      resourceKey: 'color/theme_background_color',
    });
  });

  it('drops plausible but unregistered resource credentials and AWS tokens', () => {
    const error = new ThemeStudioError({
      code: 'KTB-ANDROID-IMAGE-RECOVERY',
      operation: 'theme:import',
      stage: 'Android 이미지 복원',
      message: 'Android 이미지 리소스를 복원하지 못했습니다.',
      safeContext: {
        resourceId: 'AKIAIOSFODNN7EXAMPLE',
        resourceKey: 'drawable/PRIVATEKEY',
      },
    });
    const credentials = new ThemeStudioError({
      code: 'KTB-ANDROID-IMAGE-RECOVERY',
      operation: 'theme:import',
      stage: 'Android 이미지 복원',
      message: 'Android 이미지 리소스를 복원하지 못했습니다.',
      safeContext: {
        resourceId: 'main.credentials',
        resourceKey: 'drawable/theme_background_image_credentials',
      },
    });

    expect(error.safeContext).toBeUndefined();
    expect(credentials.safeContext).toBeUndefined();
  });

  it('keeps only known system codes and process signals', () => {
    const known = new ThemeStudioError({
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '파일 쓰기',
      message: '파일을 저장하지 못했습니다.',
      safeContext: {
        systemCode: 'ENOSPC',
        signal: 'SIGTERM',
      },
    });

    expect(known.safeContext).toEqual({
      systemCode: 'ENOSPC',
      signal: 'SIGTERM',
    });

    for (const value of [
      'CREDENTIALS',
      'PRIVATEKEY',
      'AKIAIOSFODNN7EXAMPLE',
    ]) {
      const error = new ThemeStudioError({
        code: 'KTB-FS-WRITE',
        operation: 'project:save',
        stage: '파일 쓰기',
        message: '파일을 저장하지 못했습니다.',
        safeContext: {
          systemCode: value,
          signal: value,
        },
      });
      expect(error.safeContext).toBeUndefined();
    }
  });

  it('falls back to catalog text when stage or message is sensitive', () => {
    const error = new ThemeStudioError({
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '/Users/person/private.ktstudio',
      message: 'password=secret data:image/png;base64,theme-contents',
    });

    expect(error.stage).toBe('파일 쓰기');
    expect(error.message).toBe('파일을 저장하지 못했습니다.');
  });

  it('normalizes a direct support object through the catalog and context registry', () => {
    const support = formatThemeStudioSupportString({
      code: 'KTB-FS-WRITE',
      stage: '노출 가능한 안전한 단계',
      message: '노출 가능한 안전한 메시지입니다.',
      safeContext: {
        resourceId: 'AKIAIOSFODNN7EXAMPLE',
        resourceKey: 'drawable/PRIVATEKEY',
        systemCode: 'CREDENTIALS',
      },
    });

    expect(support).toBe([
      '[KTB-FS-WRITE]',
      '파일을 저장하지 못했습니다.',
      '단계: 파일 쓰기',
    ].join('\n'));
    expect(support).not.toMatch(/AKIA|PRIVATEKEY|CREDENTIALS/);
  });

  it('normalizes a runtime-mutated error before formatting support text', () => {
    const error = new ThemeStudioError({
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '파일 쓰기',
      message: '파일을 저장하지 못했습니다.',
      safeContext: { systemCode: 'ENOSPC' },
    });
    Object.assign(error, {
      code: 'constructor',
      stage: '/Users/person/private.ktstudio',
      message: 'data:image/png;base64,secret',
    });
    Object.assign(error.safeContext!, {
      systemCode: 'AKIAIOSFODNN7EXAMPLE',
    });

    expect(formatThemeStudioSupportString(error)).toBe([
      '[KTB-UNKNOWN-UNEXPECTED]',
      '예상하지 못한 오류가 발생했습니다.',
      '단계: 알 수 없는 작업',
    ].join('\n'));
  });
});
