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
    expect(isThemeStudioErrorPayload({
      ...base,
      code: 'toString',
    })).toBe(false);
    expect(isThemeStudioErrorPayload({
      ...base,
      unexpected: 'field',
    })).toBe(false);
  });

  it('rejects arrays, class instances, inherited fields, and unknown own fields', () => {
    const payload = serializeThemeStudioError(new ThemeStudioError({
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '파일 쓰기',
      message: '파일을 저장하지 못했습니다.',
    }));
    class Payload {
      name = payload.name;
      code = payload.code;
      operation = payload.operation;
      stage = payload.stage;
      message = payload.message;
    }

    expect(isThemeStudioErrorPayload(Object.assign([], payload))).toBe(false);
    expect(isThemeStudioErrorPayload(new Payload())).toBe(false);
    expect(isThemeStudioErrorPayload(Object.create(payload))).toBe(false);
    expect(isThemeStudioErrorPayload({
      ...payload,
      [Symbol('secret')]: 'password=secret',
    })).toBe(false);
  });

  it('accepts explicitly undefined optional payload fields', () => {
    const payload = serializeThemeStudioError(new ThemeStudioError({
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '파일 쓰기',
      message: '파일을 저장하지 못했습니다.',
    }));

    expect(isThemeStudioErrorPayload({
      ...payload,
      safeContext: undefined,
      cause: undefined,
    })).toBe(true);
  });

  it('rejects sensitive text and unsafe values under allowed context keys', () => {
    const base = serializeThemeStudioError(new ThemeStudioError({
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '파일 쓰기',
      message: '파일을 저장하지 못했습니다.',
    }));
    const unsafeValues = [
      { resourceId: '/Users/person/private.ktstudio' },
      { resourceKey: 'data:image/png;base64,secret' },
      { stage: '{"KakaoTalkTheme.css":"theme contents"}' },
      { signal: 'PASSWORD=secret' },
      { systemCode: 'TOKEN=secret' },
      { platform: 'C:\\private\\signing.keystore' },
    ];

    for (const safeContext of unsafeValues) {
      expect(isThemeStudioErrorPayload({ ...base, safeContext })).toBe(false);
    }
    expect(isThemeStudioErrorPayload({
      ...base,
      stage: '/Users/person/private.ktstudio',
    })).toBe(false);
    expect(isThemeStudioErrorPayload({
      ...base,
      message: '-----BEGIN PRIVATE KEY-----',
    })).toBe(false);
  });

  it('re-sanitizes mutated fields before serialization', () => {
    const error = new ThemeStudioError({
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '파일 쓰기',
      message: '파일을 저장하지 못했습니다.',
      safeContext: { resourceId: 'main.background' },
    });
    Object.assign(error, {
      stage: '/Users/person/private.ktstudio',
      message: 'token=secret',
    });
    Object.assign(error.safeContext!, {
      resourceId: 'data:image/png;base64,secret',
    });

    expect(serializeThemeStudioError(error)).toEqual({
      name: 'ThemeStudioError',
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '파일 쓰기',
      message: '파일을 저장하지 못했습니다.',
    });
  });

  it('publishes catalog text instead of safe custom internal text', () => {
    const payload = serializeThemeStudioError(new ThemeStudioError({
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '사용자 지정 저장 단계',
      message: '사용자 지정 저장 오류입니다.',
    }));

    expect(payload).toMatchObject({
      code: 'KTB-FS-WRITE',
      stage: '파일 쓰기',
      message: '파일을 저장하지 못했습니다.',
    });
    expect(isThemeStudioErrorPayload({
      ...payload,
      stage: '다른 안전한 단계',
    })).toBe(false);
    expect(isThemeStudioErrorPayload({
      ...payload,
      message: '다른 안전한 오류입니다.',
    })).toBe(false);
  });

  it('uses the unknown catalog entry after runtime code mutation', () => {
    const error = new ThemeStudioError({
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '파일 쓰기',
      message: '파일을 저장하지 못했습니다.',
    });
    Object.assign(error, {
      code: 'toString',
      operation: 'project:save',
      stage: '노출 가능한 안전한 단계',
      message: '노출 가능한 안전한 메시지입니다.',
    });

    expect(serializeThemeStudioError(error)).toMatchObject({
      code: 'KTB-UNKNOWN-UNEXPECTED',
      operation: 'project:save',
      stage: '알 수 없는 작업',
      message: '예상하지 못한 오류가 발생했습니다.',
    });
  });

  it('omits cyclic and over-depth structured causes during serialization', () => {
    const cyclic = new ThemeStudioError({
      code: 'KTB-UNKNOWN-UNEXPECTED',
      operation: 'ipc:validate',
      stage: '알 수 없는 작업',
      message: '예상하지 못한 오류가 발생했습니다.',
    });
    Object.assign(cyclic, { cause: cyclic });

    expect(serializeThemeStudioError(cyclic)).not.toHaveProperty('cause');

    let deep = cyclic;
    Object.assign(deep, { cause: undefined });
    for (let index = 0; index < 12; index += 1) {
      deep = new ThemeStudioError({
        code: 'KTB-UNKNOWN-UNEXPECTED',
        operation: 'ipc:validate',
        stage: '알 수 없는 작업',
        message: '예상하지 못한 오류가 발생했습니다.',
        cause: deep,
      });
    }
    let payload: unknown = serializeThemeStudioError(deep);
    let depth = 0;
    while (payload && typeof payload === 'object') {
      depth += 1;
      payload = (payload as { cause?: unknown }).cause;
    }
    expect(depth).toBe(8);
  });

  it('rejects cyclic and over-depth payload cause chains', () => {
    const leaf = serializeThemeStudioError(new ThemeStudioError({
      code: 'KTB-UNKNOWN-UNEXPECTED',
      operation: 'ipc:validate',
      stage: '알 수 없는 작업',
      message: '예상하지 못한 오류가 발생했습니다.',
    }));
    const cyclic = { ...leaf, cause: undefined as unknown };
    cyclic.cause = cyclic;
    expect(isThemeStudioErrorPayload(cyclic)).toBe(false);

    let eightDeep: Record<string, unknown> = { ...leaf };
    for (let index = 1; index < 8; index += 1) {
      eightDeep = { ...leaf, cause: eightDeep };
    }
    expect(isThemeStudioErrorPayload(eightDeep)).toBe(true);
    expect(isThemeStudioErrorPayload({
      ...leaf,
      cause: eightDeep,
    })).toBe(false);
  });

  it('rejects unregistered resource and system vocabularies', () => {
    const payload = serializeThemeStudioError(new ThemeStudioError({
      code: 'KTB-ANDROID-IMAGE-RECOVERY',
      operation: 'theme:import',
      stage: 'Android 이미지 복원',
      message: 'Android 이미지 리소스를 복원하지 못했습니다.',
    }));

    for (const safeContext of [
      { resourceId: 'AKIAIOSFODNN7EXAMPLE' },
      { resourceKey: 'drawable/PRIVATEKEY' },
      { systemCode: 'CREDENTIALS' },
      { signal: 'AKIAIOSFODNN7EXAMPLE' },
      { stage: '등록되지 않은 단계' },
    ]) {
      expect(isThemeStudioErrorPayload({
        ...payload,
        safeContext,
      })).toBe(false);
    }
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
