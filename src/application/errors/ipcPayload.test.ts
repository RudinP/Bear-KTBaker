import { describe, expect, it } from 'vitest';
import { ThemeStudioError } from './ThemeStudioError';
import {
  isThemeStudioErrorPayload,
  reconstructThemeStudioError,
  serializeThemeStudioError,
  type ThemeIpcResult,
} from './ipcPayload';
import { formatThemeStudioSupportString } from './supportString';

const reusedDiagnosticVariants = [
  ['KTB-PROJECT-INVALID-FORMAT', 'project:save', '프로젝트 파일 검증', '테마 스튜디오 프로젝트 파일을 읽지 못했습니다.'],
  ['KTB-PROJECT-INVALID-FORMAT', 'theme:import', '프로젝트 파일 검증', '테마 스튜디오 프로젝트 파일을 읽지 못했습니다.'],
  ['KTB-PROJECT-MIGRATION', 'project:save', '이전 프로젝트 변환', '이전 버전 프로젝트를 변환하지 못했습니다.'],
  ['KTB-PROJECT-MIGRATION', 'theme:import', '이전 프로젝트 변환', '이전 버전 프로젝트를 변환하지 못했습니다.'],
  ['KTB-FS-READ', 'theme:import', '선택한 테마 파일 읽기', '선택한 테마 파일을 읽지 못했습니다.'],
  ['KTB-FS-READ', 'theme:export-android', 'Android 템플릿 읽기', 'Android 테마 템플릿을 읽지 못했습니다.'],
  ['KTB-FS-READ', 'theme:export-android', 'Android 템플릿 압축 읽기', 'Android 테마 템플릿 압축을 읽지 못했습니다.'],
  ['KTB-FS-READ', 'theme:export-android', 'Android 이미지 템플릿 읽기', 'Android 이미지 템플릿을 읽지 못했습니다.'],
  ['KTB-FS-WRITE', 'project:save', '프로젝트 파일 쓰기', '프로젝트 파일을 저장하지 못했습니다.'],
  ['KTB-FS-WRITE', 'project:save', '프로젝트 저장', '프로젝트를 저장하지 못했습니다.'],
  ['KTB-FS-WRITE', 'theme:export-ios', 'iPhone 테마 파일 쓰기', 'iPhone 테마 파일을 저장하지 못했습니다.'],
  ['KTB-FS-WRITE', 'theme:export-android', 'Android 템플릿 압축 해제', 'Android 테마 템플릿을 준비하지 못했습니다.'],
  ['KTB-FS-WRITE', 'theme:export-android', 'Android 메타데이터 생성', 'Android 테마 메타데이터를 만들지 못했습니다.'],
  ['KTB-FS-WRITE', 'theme:export-android', 'Android APK 파일 복사', '완성된 Android APK를 저장하지 못했습니다.'],
  ['KTB-FS-WRITE', 'theme:export-android', 'Android 이미지 리소스 쓰기', 'Android 이미지 리소스를 저장하지 못했습니다.'],
  ['KTB-FS-WRITE', 'screenshots:save', '홍보 이미지 파일 쓰기', '홍보 이미지를 저장하지 못했습니다.'],
  ['KTB-FS-TEMP', 'theme:export-android', 'Android 임시 폴더 생성', 'Android 임시 작업 폴더를 만들지 못했습니다.'],
  ['KTB-FS-TEMP', 'theme:export-android', 'Android 임시 폴더 정리', 'Android 임시 작업 폴더를 정리하지 못했습니다.'],
  ['KTB-IMAGE-DECODE', 'theme:export-ios', 'iPhone 이미지 디코딩', 'iPhone 테마 이미지를 읽지 못했습니다.'],
  ['KTB-IMAGE-DECODE', 'theme:export-ios', 'iPhone 이미지 변환', 'iPhone 테마 이미지를 변환하지 못했습니다.'],
  ['KTB-IMAGE-DECODE', 'theme:export-android', 'Android 이미지 디코딩', 'Android 테마 이미지를 읽지 못했습니다.'],
  ['KTB-IMAGE-DECODE', 'theme:export-android', 'Android 이미지 템플릿 디코딩', 'Android 이미지 템플릿을 읽지 못했습니다.'],
  ['KTB-IMAGE-DECODE', 'theme:export-android', 'Android 이미지 변환', 'Android 테마 이미지를 변환하지 못했습니다.'],
  ['KTB-IMAGE-DECODE', 'screenshots:save', '홍보 이미지 디코딩', '홍보 이미지 데이터를 읽지 못했습니다.'],
  ['KTB-IMAGE-DECODE', 'screenshots:save', '홍보 이미지 디코딩', '홍보 이미지는 PNG 형식이어야 합니다.'],
  ['KTB-IMAGE-NINE-PATCH', 'theme:export-android', 'Android 9-patch 템플릿 적용', 'Android 9-patch 기준 이미지를 찾지 못했습니다.'],
  ['KTB-IOS-EXPORT-TEMPLATE', 'theme:export-ios', 'iPhone 템플릿 읽기', 'iPhone 테마 템플릿을 읽지 못했습니다.'],
  ['KTB-IOS-EXPORT-TEMPLATE', 'theme:export-ios', 'iPhone 템플릿 압축 읽기', 'iPhone 테마 템플릿을 읽지 못했습니다.'],
  ['KTB-IOS-EXPORT-TEMPLATE', 'theme:export-ios', 'iPhone 템플릿 CSS 읽기', 'iPhone 테마 템플릿 CSS를 읽지 못했습니다.'],
  ['KTB-IPC-INVALID-REQUEST', 'ipc:validate', '요청 데이터 검증', '앱 요청 데이터가 올바르지 않습니다.'],
  ['KTB-IPC-INVALID-REQUEST', 'screenshots:save', '홍보 이미지 파일명 검증', '홍보 이미지 파일명이 올바르지 않습니다.'],
  ['KTB-UNKNOWN-UNEXPECTED', 'theme:import', '테마 가져오기', '테마를 가져오지 못했습니다.'],
  ['KTB-UNKNOWN-UNEXPECTED', 'theme:export-android', 'Android 테마 내보내기', 'Android 테마를 내보내지 못했습니다.'],
  ['KTB-UNKNOWN-UNEXPECTED', 'theme:export-android', 'Android APK 빌드', 'Android APK를 만들지 못했습니다.'],
  ['KTB-UNKNOWN-UNEXPECTED', 'ipc:validate', '오류 응답 검증', '앱 오류 응답을 읽지 못했습니다.'],
] as const;

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

  it.each(reusedDiagnosticVariants)(
    'preserves the catalog-owned %s variant for %s / %s through IPC and support formatting',
    (code, operation, stage, message) => {
      const payload = serializeThemeStudioError(new ThemeStudioError({
        code,
        operation,
        stage,
        message,
      }));
      const reconstructed = reconstructThemeStudioError(payload);

      expect(payload).toMatchObject({ code, operation, stage, message });
      expect(isThemeStudioErrorPayload(payload)).toBe(true);
      expect(reconstructed).toMatchObject({ code, operation, stage, message });
      expect(formatThemeStudioSupportString(reconstructed)).toBe([
        `[${code}]`,
        message,
        `단계: ${stage}`,
      ].join('\n'));
    },
  );

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
      operation: 'ipc:validate',
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
