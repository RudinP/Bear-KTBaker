import { describe, expect, it } from 'vitest';
import { ThemeStudioError } from './ThemeStudioError';
import {
  isThemeStudioErrorPayload,
  reconstructThemeStudioError,
  serializeThemeStudioError,
  type ThemeIpcResult,
} from './ipcPayload';

describe('ThemeStudioError IPC payload', () => {
  it('serializes only allowlisted context', () => {
    const payload = serializeThemeStudioError(new ThemeStudioError({
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '프로젝트 파일 쓰기',
      message: '프로젝트를 저장하지 못했습니다.',
      safeContext: {
        exitCode: 1,
        systemCode: 'ENOSPC',
        filePath: '/Users/person/private.ktstudio',
        dataUrl: 'data:image/png;base64,secret',
        password: 'secret',
      },
    }));

    expect(payload.safeContext).toEqual({
      exitCode: 1,
      systemCode: 'ENOSPC',
    });
    expect(JSON.stringify(payload)).not.toContain('/Users/person');
    expect(JSON.stringify(payload)).not.toContain('base64');
    expect(JSON.stringify(payload)).not.toContain('secret');
  });

  it('omits a native Error cause and serializes a ThemeStudioError cause', () => {
    const nativeCause = serializeThemeStudioError(new ThemeStudioError({
      code: 'KTB-FS-READ',
      operation: 'theme:import',
      stage: '파일 읽기',
      message: '파일을 읽지 못했습니다.',
      cause: new Error('/Users/person/private.ktheme'),
    }));
    const nestedCause = new ThemeStudioError({
      code: 'KTB-IMAGE-DECODE',
      operation: 'theme:import',
      stage: '이미지 디코딩',
      message: '이미지 파일을 읽지 못했습니다.',
      safeContext: { resourceId: 'main.background' },
    });
    const nested = serializeThemeStudioError(new ThemeStudioError({
      code: 'KTB-IOS-IMPORT-ARCHIVE',
      operation: 'theme:import',
      stage: 'iPhone 테마 압축 읽기',
      message: 'iPhone 테마 압축을 읽지 못했습니다.',
      cause: nestedCause,
    }));

    expect(nativeCause).not.toHaveProperty('cause');
    expect(JSON.stringify(nativeCause)).not.toContain('/Users/person');
    expect(nested.cause).toEqual(serializeThemeStudioError(nestedCause));
  });

  it('validates and reconstructs a serialized error tree', () => {
    const payload = serializeThemeStudioError(new ThemeStudioError({
      code: 'KTB-IOS-IMPORT-ARCHIVE',
      operation: 'theme:import',
      stage: 'iPhone 테마 압축 읽기',
      message: 'iPhone 테마 압축을 읽지 못했습니다.',
      cause: new ThemeStudioError({
        code: 'KTB-IMAGE-DECODE',
        operation: 'theme:import',
        stage: '이미지 디코딩',
        message: '이미지 파일을 읽지 못했습니다.',
      }),
    }));

    expect(isThemeStudioErrorPayload(payload)).toBe(true);
    const reconstructed = reconstructThemeStudioError(payload);
    expect(reconstructed).toBeInstanceOf(ThemeStudioError);
    expect(reconstructed.cause).toBeInstanceOf(ThemeStudioError);
    expect((reconstructed.cause as ThemeStudioError).code)
      .toBe('KTB-IMAGE-DECODE');
  });

  it('rejects unknown codes, operations, and context keys', () => {
    const base = {
      name: 'ThemeStudioError',
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '파일 쓰기',
      message: '파일을 저장하지 못했습니다.',
    };

    expect(isThemeStudioErrorPayload({
      ...base,
      code: 'KTB-NOT-REGISTERED',
    })).toBe(false);
    expect(isThemeStudioErrorPayload({
      ...base,
      operation: 'credentials:read',
    })).toBe(false);
    expect(isThemeStudioErrorPayload({
      ...base,
      safeContext: { filePath: '/Users/person/private.ktstudio' },
    })).toBe(false);
  });

  it('returns a safe fallback for an invalid payload', () => {
    const invalidPayload = {
      name: 'ThemeStudioError',
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '파일 쓰기',
      message: '파일을 저장하지 못했습니다.',
      safeContext: { password: 'secret' },
    };

    const reconstructed = reconstructThemeStudioError(
      invalidPayload as never,
    );

    expect(reconstructed).toMatchObject({
      code: 'KTB-UNKNOWN-UNEXPECTED',
      operation: 'ipc:validate',
      stage: '오류 응답 검증',
      message: '앱 오류 응답을 읽지 못했습니다.',
    });
    expect(JSON.stringify(reconstructed)).not.toContain('secret');
  });

  it('exposes the generic IPC result contract', () => {
    const result: ThemeIpcResult<number> = { ok: true, value: 3 };
    expect(result).toEqual({ ok: true, value: 3 });
  });
});
